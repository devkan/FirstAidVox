"""
Enhanced Vertex AI Gemini service with conversational diagnosis approach.
Implements systematic medical triage through step-by-step questioning.
"""

import json
import logging
import os
import time
import re
from typing import List, Optional, Dict, Any
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from google.oauth2 import service_account

from config.settings import get_settings
from config.logging import get_service_logger, get_metrics_collector
from app.models.internal import AIResponse, FunctionCall
from app.services.search_service import VertexSearchClient


logger = logging.getLogger(__name__)


def detect_language(text: str) -> str:
    """
    Detect the language of the input text.
    
    Args:
        text: Input text to analyze
        
    Returns:
        Language code ('ko' for Korean, 'en' for English, 'ja' for Japanese, 'es' for Spanish)
    """
    # Remove punctuation and convert to lowercase for analysis
    clean_text = re.sub(r'[^\w\s]', '', text.lower())
    
    # Korean detection - look for Hangul characters (more comprehensive range)
    if re.search(r'[가-힣ㄱ-ㅎㅏ-ㅣ]', text):
        return 'ko'
    
    # Japanese detection - look for Hiragana, Katakana, or Kanji (more comprehensive)
    if re.search(r'[ひ-ゖヰ-ヺカ-ヿ一-龯ァ-ヴ]', text):
        return 'ja'
    
    # Spanish detection - look for Spanish-specific words and patterns
    spanish_indicators = [
        'dolor', 'cabeza', 'estómago', 'fiebre', 'náuseas', 'mareo', 'sangre',
        'herida', 'corte', 'quemadura', 'fractura', 'emergencia', 'hospital',
        'médico', 'ayuda', 'duele', 'siento', 'tengo', 'estoy', 'me duele',
        'qué', 'cómo', 'cuándo', 'dónde', 'por qué'
    ]
    
    if any(indicator in clean_text for indicator in spanish_indicators):
        return 'es'
    
    # Korean romanized or common Korean medical terms
    korean_indicators = [
        '아파', '아픈', '머리', '배', '열', '기침', '감기', '병원', '의사', '약',
        'apa', 'apun', 'meori', 'bae', 'yeol', 'gichim', 'gamgi'
    ]
    
    if any(indicator in clean_text for indicator in korean_indicators):
        return 'ko'
    
    # Default to English
    return 'en'


class ConversationalGeminiClient:
    """
    Enhanced Gemini client with conversational diagnosis capabilities.
    Conducts systematic medical triage through step-by-step questioning.
    """
    
    def __init__(self):
        """Initialize the conversational Gemini client."""
        self.settings = get_settings()
        self._model = None
        self._project_id = self.settings.google_cloud_project_id
        self._location = self.settings.vertex_ai_location
        self._model_name = self.settings.gemini_model_name
        
        # Initialize search client for RAG
        self.search_client = VertexSearchClient()
        
        # Conversational medical triage system prompt (optimized for efficiency)
        self._system_prompt = """You are an efficient medical triage AI assistant. Your goal is to quickly assess symptoms with 3-4 strategic questions and provide a final diagnosis with complete recommendations.

CRITICAL LANGUAGE INSTRUCTION: 
- Respond in the SAME LANGUAGE as the user's input
- Korean input → Korean response
- English input → English response  
- Japanese input → Japanese response
- Spanish input → Spanish response

EFFICIENT TRIAGE APPROACH:
1. INITIAL: Ask about the MOST IMPORTANT symptoms together (duration, severity, associated symptoms)
2. CLARIFICATION: Ask 1-2 follow-up questions about key differentiating factors
3. FINAL: Provide diagnosis, recommendations, and END the conversation

CRITICAL RULE: After 2-3 exchanges (when you have basic symptom information), you MUST provide a final diagnosis. DO NOT ask more questions.

QUESTION STRATEGY:
- Combine multiple related questions into ONE message
- Focus on symptoms that help differentiate between common conditions
- Don't ask redundant questions about information already provided
- Move to diagnosis quickly after gathering essential information

FINAL DIAGNOSIS FORMAT (MANDATORY after 2-3 exchanges):
When providing final diagnosis, ALWAYS include ALL of these elements:
1. **Diagnosis**: Clear assessment of the likely condition
2. **Immediate Care**: What to do right now (rest, fluids, medications)
3. **Hospital Visit**: When to see a doctor (specific departments like internal medicine, ENT)
4. **Pharmacy**: What medications can be bought over-the-counter
5. **Emergency Warning**: When to call 911/119 or go to emergency room
6. **Conversation Ending**: Clear statement that consultation is complete

MANDATORY FINAL RESPONSE TEMPLATE:
BRIEF: **Diagnosis**: [Condition name]
**Immediate Care**: [Rest, fluids, etc.]
**Hospital**: [When to visit doctor and which department]
**Pharmacy**: [Over-the-counter medications available]
**Emergency**: [When to call 911/119]
**Consultation completed** - [Closing message]

DETAILED: [Complete care instructions and explanation]

EXAMPLE EFFICIENT FLOW:
User: "I have headache and fever"
AI: "I understand you have a headache and fever. When did these symptoms start, and do you have any sore throat, cough, or body aches?"

User: "Started yesterday, also have sore throat and cough, fever is 38C"
AI: "BRIEF: **Diagnosis**: Upper respiratory infection (common cold/flu)
**Immediate Care**: Rest, drink plenty of fluids, take acetaminophen or ibuprofen for fever
**Hospital**: Visit family doctor or urgent care if symptoms worsen or persist beyond 7 days
**Pharmacy**: Acetaminophen, ibuprofen, throat lozenges, and cough drops available over-the-counter
**Emergency**: Call 911 if you develop difficulty breathing, chest pain, or fever above 39°C (102°F)
**Consultation completed** - Rest well and monitor your symptoms.

DETAILED: Based on your symptoms of headache, fever (38°C), sore throat, and cough starting yesterday, this appears to be a typical upper respiratory infection. Most cases resolve within 5-7 days with supportive care. Stay hydrated, get plenty of rest, and use over-the-counter medications as needed for comfort."

EMERGENCY INDICATORS (require immediate 911/119 call):
- High fever (39°C+/102°F+), difficulty breathing, severe chest pain, severe headache, loss of consciousness, severe dehydration

CONVERSATION ENDING PHRASES:
- Korean: "상담이 완료되었습니다"
- English: "Consultation completed"
- Japanese: "相談が完了しました"
- Spanish: "Consulta completada"

CRITICAL RULES:
- Maximum 3 exchanges before providing final diagnosis
- NEVER ask follow-up questions after providing final diagnosis
- ALWAYS include all 6 elements in final diagnosis (diagnosis, care, hospital, pharmacy, emergency, ending)
- ALWAYS include emergency contact information (911/119)
- ALWAYS end conversation clearly after diagnosis
- Use search_hospitals function when providing final diagnosis
"""
    
    async def initialize(self) -> None:
        """Initialize the Vertex AI client with authentication."""
        try:
            # Load service account credentials
            key_path = self.settings.service_account_key_path
            if not os.path.exists(key_path):
                raise FileNotFoundError(f"Service account key file not found: {key_path}")
            
            credentials = service_account.Credentials.from_service_account_file(
                key_path,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            
            # Initialize Vertex AI
            vertexai.init(
                project=self._project_id,
                location=self._location,
                credentials=credentials
            )
            
            # Initialize the Gemini model
            self._model = GenerativeModel(self._model_name)
            
            logger.info(
                f"Initialized Conversational Vertex AI Gemini client for project {self._project_id} in {self._location}"
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize Conversational Vertex AI client: {e}")
            raise ConnectionError(f"Vertex AI initialization failed: {e}") from e
    
    def validate_connection(self) -> bool:
        """Validate that the Vertex AI connection is working."""
        try:
            if not self._model:
                return False
            
            logger.debug("Conversational Vertex AI Gemini model initialized")
            return True
            
        except Exception as e:
            logger.error(f"Vertex AI connection validation failed: {e}")
            return False
    
    async def generate_conversational_response(
        self, 
        text: str, 
        conversation_history: Optional[List[Dict[str, str]]] = None,
        image_data: Optional[bytes] = None,
        location: Optional[Dict[str, float]] = None,
        use_mock: bool = False  # Add mock mode for testing
    ) -> AIResponse:
        """
        Generate conversational medical triage response using systematic questioning.
        
        Args:
            text: User's current message
            conversation_history: Previous conversation messages for context
            image_data: Optional image data for vision analysis
            location: Optional location coordinates for hospital search context
            use_mock: If True, return mock response for testing
            
        Returns:
            AIResponse containing generated text and any function calls
        """
        # Check for mock mode or if model is not initialized
        if use_mock or not self._model:
            return self._generate_mock_response(text, conversation_history)
        
        if not text or not text.strip():
            raise ValueError("Text input cannot be empty")
        
        start_time = time.time()
        
        try:
            # Detect user's language
            user_language = detect_language(text)
            logger.info(f"Detected user language: {user_language} for text: '{text[:50]}...'")
            
            # Debug: Print character analysis
            has_hangul = bool(re.search(r'[가-힣ㄱ-ㅎㅏ-ㅣ]', text))
            logger.info(f"Korean character detection: {has_hangul} for text: '{text}'")
            
            # Check if consultation was already completed in conversation history
            consultation_completed = False
            if conversation_history:
                for msg in conversation_history:
                    if msg.get("role") == "assistant":
                        content = msg.get("content", "").lower()
                        if ("consultation completed" in content or 
                            "상담이 완료" in content or 
                            "diagnosis" in content and ("hospital" in content or "pharmacy" in content)):
                            consultation_completed = True
                            break
            
            # If consultation was already completed, provide a brief acknowledgment
            if consultation_completed:
                if user_language == 'ko':
                    brief_response = "상담이 이미 완료되었습니다. 추가 증상이나 우려사항이 있으시면 의료진에게 직접 문의하시기 바랍니다."
                    detailed_advice = "이전에 제공된 진단과 권장사항을 참고하시고, 증상이 악화되거나 새로운 증상이 나타나면 병원을 방문하세요."
                else:
                    brief_response = "The consultation has already been completed. If you have additional symptoms or concerns, please consult with a healthcare professional directly."
                    detailed_advice = "Please refer to the previous diagnosis and recommendations provided. If symptoms worsen or new symptoms appear, visit a healthcare facility."
                
                return AIResponse(
                    text=f"BRIEF: {brief_response}\n\nDETAILED: {detailed_advice}",
                    brief_text=brief_response,
                    detailed_text=detailed_advice,
                    function_calls=[],
                    metadata={
                        "assessment_stage": "completed",
                        "conversation_length": len(conversation_history),
                        "user_language": user_language,
                        "consultation_completed": True
                    }
                )
            
            # Build conversation context
            conversation_context = ""
            if conversation_history:
                conversation_context = "\n\nCONVERSATION HISTORY:\n"
                for i, msg in enumerate(conversation_history[-6:]):  # Last 6 messages for context
                    role = "User" if msg.get("role") == "user" else "AI"
                    conversation_context += f"{role}: {msg.get('content', '')}\n"
                conversation_context += "\n"
            
            # Search for relevant medical documents using RAG
            logger.info("Searching for relevant medical documents...")
            # Temporarily disable RAG search to debug timeout issue
            # search_results = await self.search_client.search_medical_documents(
            #     query=text,
            #     max_results=3,
            #     include_snippets=True
            # )
            search_results = []
            
            # Format search results as context
            medical_context = ""  # self.search_client.format_search_results_for_context(search_results)
            
            # Language-specific instruction
            language_instruction = ""
            if user_language == 'ko':
                language_instruction = f"""
CRITICAL LANGUAGE REQUIREMENT: The user wrote in Korean (한국어): "{text}"
You MUST respond ENTIRELY in Korean. Use natural Korean medical terminology.
Example Korean response format:
BRIEF: 머리가 아프시는군요. 정확한 진단을 위해 언제부터 아프기 시작했는지 알려주세요.
DETAILED: 두통의 원인을 파악하기 위해 증상이 언제 시작되었는지, 갑작스럽게 시작되었는지 서서히 시작되었는지 알아야 합니다.
"""
            elif user_language == 'ja':
                language_instruction = f"""
CRITICAL LANGUAGE REQUIREMENT: The user wrote in Japanese (日本語): "{text}"
You MUST respond ENTIRELY in Japanese. Use natural Japanese medical terminology.
Example Japanese response format:
BRIEF: 頭痛でお困りですね。適切な診断のために、いつから痛み始めたか教えてください。
DETAILED: 頭痛の原因を特定するために、症状がいつ始まったか、突然始まったか徐々に始まったかを知る必要があります。
"""
            elif user_language == 'es':
                language_instruction = f"""
CRITICAL LANGUAGE REQUIREMENT: The user wrote in Spanish (Español): "{text}"
You MUST respond ENTIRELY in Spanish. Use natural Spanish medical terminology.
Example Spanish response format:
BRIEF: Entiendo que tiene dolor de cabeza. Para evaluar esto correctamente, ¿cuándo comenzó el dolor?
DETAILED: Para identificar la causa del dolor de cabeza, necesito saber cuándo comenzaron los síntomas y si comenzaron repentinamente o gradualmente.
"""
            else:
                language_instruction = f"""
CRITICAL LANGUAGE REQUIREMENT: The user wrote in English: "{text}"
You MUST respond ENTIRELY in English. Use clear English medical terminology.
"""
            
            # Build enhanced prompt with conversation context (simplified)
            if image_data:
                enhanced_prompt = f"""{self._system_prompt}{language_instruction}

{conversation_context}

IMPORTANT: The user has provided an image. Analyze it for visible injuries or symptoms.

Current user message: {text}

CRITICAL: Check conversation history. If a previous response included "Consultation completed" or provided a final diagnosis with hospital/pharmacy information, DO NOT ask more questions. Instead, acknowledge that the consultation is complete and refer them to seek medical attention if needed."""
            else:
                enhanced_prompt = f"""{self._system_prompt}{language_instruction}

{conversation_context}

Current user message: {text}

CRITICAL: Check conversation history. If a previous response included "Consultation completed" or provided a final diagnosis with hospital/pharmacy information, DO NOT ask more questions. Instead, acknowledge that the consultation is complete and refer them to seek medical attention if needed."""
            
            # Prepare content parts
            content_parts = [enhanced_prompt]
            
            # Add image if provided
            if image_data:
                import imghdr
                image_type = imghdr.what(None, h=image_data)
                
                if image_type == 'jpeg':
                    mime_type = "image/jpeg"
                elif image_type == 'png':
                    mime_type = "image/png"
                elif image_type == 'webp':
                    mime_type = "image/webp"
                else:
                    mime_type = "image/jpeg"
                
                logger.info(f"Adding image to conversational request: {len(image_data)} bytes, MIME type: {mime_type}")
                
                image_part = Part.from_data(
                    mime_type=mime_type,
                    data=image_data
                )
                content_parts.append(image_part)
            
            # Generate response using Gemini
            logger.info(f"Generating conversational response with Gemini model. Has image: {image_data is not None}")
            
            # Add timeout to prevent hanging
            import asyncio
            import concurrent.futures
            
            try:
                # Run the synchronous Gemini call in a thread pool with timeout
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(self._model.generate_content, content_parts)
                    response = await asyncio.wait_for(
                        asyncio.wrap_future(future),
                        timeout=15.0  # 15 second timeout (reduced from 30)
                    )
            except asyncio.TimeoutError:
                logger.error("Gemini API call timed out after 15 seconds")
                raise ConnectionError("AI service request timed out")
            except Exception as e:
                logger.error(f"Gemini API call failed: {e}")
                raise
            
            logger.info(f"Conversational Gemini response received. Response text length: {len(response.text) if response.text else 0}")
            
            response_text = response.text if response.text else "I apologize, but I couldn't generate a response. Please try again or seek immediate medical attention if this is an emergency."
            
            # Parse structured response and determine assessment stage
            brief_response = response_text
            detailed_advice = response_text
            assessment_stage = "exploration"  # Default stage
            
            if "BRIEF:" in response_text and "DETAILED:" in response_text:
                try:
                    parts = response_text.split("DETAILED:")
                    brief_part = parts[0].replace("BRIEF:", "").strip()
                    detailed_part = parts[1].strip()
                    
                    if brief_part and detailed_part:
                        brief_response = brief_part
                        detailed_advice = detailed_part
                        logger.info("Successfully parsed structured conversational response")
                except Exception as e:
                    logger.warning(f"Failed to parse structured conversational response: {e}")
            
            # Determine assessment stage based on conversation history FIRST
            # Conversation count is the primary factor, not keywords
            if conversation_history:
                message_count = len(conversation_history)
                # Force final diagnosis after 4+ messages (2 user + 2 AI exchanges)
                if message_count >= 4:
                    assessment_stage = "final"
                elif message_count <= 1:
                    assessment_stage = "initial"
                else:
                    assessment_stage = "clarification"
            else:
                assessment_stage = "initial"
            
            # Check for final diagnosis markers in response
            lower_response = response_text.lower()
            
            # Explicit completion markers (strongest signal)
            explicit_final_markers = [
                'consultation completed', '상담이 완료', '상담 완료',
                'assessment complete', 'final diagnosis', '최종 진단',
                '相談が完了', 'consulta completada'
            ]
            
            # Diagnosis content markers (indicates a diagnosis was given)
            diagnosis_markers = [
                '**diagnosis**:', 'diagnosis:', '**진단**:', '진단:',
                '**immediate care**:', 'immediate care:', '즉시 관리:',
                '**hospital**:', 'hospital:', '**병원**:', '병원:',
                '**pharmacy**:', 'pharmacy:', '**약국**:', '약국:',
                '**emergency**:', 'emergency:', '**응급**:', '응급상황:',
                'upper respiratory', 'common cold', 'flu', 'infection',
                '감기', '상기도 감염', '독감', '바이러스'
            ]
            
            # Upgrade to final if:
            # 1. Explicit completion markers found (any stage)
            # 2. Diagnosis content markers found AND at least 2 messages in history
            has_explicit_markers = any(marker in lower_response for marker in explicit_final_markers)
            has_diagnosis_content = any(marker in lower_response for marker in diagnosis_markers)
            
            if has_explicit_markers:
                assessment_stage = "final"
                logger.info("Upgraded to final stage due to explicit completion markers")
            elif has_diagnosis_content and conversation_history and len(conversation_history) >= 2:
                assessment_stage = "final"
                logger.info("Upgraded to final stage due to diagnosis content markers")
            
            # Log the stage determination
            logger.info(f"Assessment stage determined: {assessment_stage} (message_count: {len(conversation_history) if conversation_history else 0})")
            
            # Determine if we should search for hospitals - ONLY for final stage
            function_calls = []
            should_search_hospitals = (
                assessment_stage == "final" and
                location and (
                    any(keyword in response_text.lower() for keyword in [
                        'hospital', 'emergency', 'doctor', 'medical help', 'seek medical attention',
                        '병원', '응급실', '의사', '의료진', '진료',
                        'hospital', 'emergencia', 'médico', 'atención médica',
                        '病院', '救急', '医者', '医療'
                    ]) or
                    any(urgency in response_text.lower() for urgency in [
                        'emergency', 'urgent', 'immediate', 'serious',
                        '응급', '긴급', '즉시', '심각',
                        'emergencia', 'urgente', 'inmediato', 'grave',
                        '緊急', '急ぎ', '重篤'
                    ])
                )
            )
            
            if should_search_hospitals:
                function_calls.append(FunctionCall(
                    name="search_hospitals",
                    parameters={
                        "latitude": location.get("latitude"),
                        "longitude": location.get("longitude"),
                        "radius_km": 10
                    }
                ))
            
            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000
            
            return AIResponse(
                text=response_text,
                brief_text=brief_response,
                detailed_text=detailed_advice,
                function_calls=function_calls,
                metadata={
                    "assessment_stage": assessment_stage,
                    "conversation_length": len(conversation_history) if conversation_history else 0,
                    "user_language": user_language
                }
            )
            
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            logger.error(f"Failed to generate conversational AI response: {e}")
            raise ConnectionError(f"Conversational AI response generation failed: {e}") from e
    
    async def close(self) -> None:
        """Clean up resources and close connections."""
        if self._model:
            self._model = None
            logger.info("Conversational Vertex AI Gemini client connection closed")
    
    def _generate_mock_response(self, text: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> AIResponse:
        """Generate a mock response for testing when API is slow."""
        user_language = detect_language(text)
        message_count = len(conversation_history) if conversation_history else 0
        
        # Force final diagnosis after 2-3 exchanges (4+ messages)
        if message_count >= 4:
            stage = "final"
        elif message_count <= 1:
            stage = "initial"
        else:
            stage = "clarification"
        
        # Generate function calls for hospital search in final stage
        function_calls = []
        if stage == "final":
            function_calls.append(FunctionCall(
                name="search_hospitals",
                parameters={
                    "latitude": 37.5665,  # Default Seoul coordinates for mock
                    "longitude": 126.9780,
                    "radius_km": 10
                }
            ))
        
        # Generate language-appropriate efficient mock responses
        if user_language == 'ko':
            if stage == "initial":
                brief = "증상을 말씀해 주셔서 감사합니다. 언제부터 시작되었고, 다른 동반 증상(열, 기침, 목 아픔 등)은 없으신가요?"
                detailed = "효과적인 진단을 위해 증상 시작 시기와 주요 동반 증상들을 함께 알려주시면 빠르게 판단할 수 있습니다."
            elif stage == "clarification":
                brief = "추가로 증상의 정도는 어떠신가요? 일상생활에 지장이 있을 정도인가요?"
                detailed = "증상의 심각성을 파악하여 적절한 치료 방향을 제시하기 위한 질문입니다."
            else:
                brief = """**진단**: 감기 또는 상기도 감염으로 보입니다
**즉시 관리**: 충분한 휴식, 수분 섭취, 해열제 복용
**병원**: 증상이 3일 이상 지속되거나 악화되면 가까운 내과나 이비인후과 방문
**약국**: 해열제(타이레놀, 부루펜), 목캔디, 기침약 구입 가능
**응급상황**: 고열(39도 이상), 호흡곤란, 심한 두통이 있으면 즉시 응급실 방문 또는 119 연락
**상담이 완료되었습니다** - 빠른 회복을 위해 충분히 쉬세요."""
                detailed = "말씀해 주신 증상들로 보아 일반적인 감기나 상기도 감염 가능성이 높습니다. 자가 관리로 호전될 가능성이 높으나, 증상이 악화되거나 지속되면 의료진의 진료를 받으시기 바랍니다."
        else:
            if stage == "initial":
                brief = "Thank you for describing your symptoms. When did this start and do you have any other symptoms like fever, cough, or sore throat?"
                detailed = "To quickly assess your condition, I need to know the timeline and key associated symptoms that help differentiate between common conditions."
            elif stage == "clarification":
                brief = "How severe are your symptoms? Are they interfering with your daily activities?"
                detailed = "Understanding the severity helps determine the appropriate level of care and urgency."
            else:
                brief = """**Diagnosis**: Upper respiratory infection (common cold/flu)
**Immediate Care**: Rest, drink plenty of fluids, take acetaminophen or ibuprofen for fever
**Hospital**: Visit family doctor or urgent care if symptoms worsen or persist beyond 7 days
**Pharmacy**: Acetaminophen, ibuprofen, throat lozenges, and cough drops available over-the-counter
**Emergency**: Call 911 if you develop difficulty breathing, chest pain, or fever above 39°C (102°F)
**Consultation completed** - Rest well and monitor your symptoms."""
                detailed = "Based on your symptoms, this appears to be a typical upper respiratory infection. Most cases resolve within 5-7 days with supportive care. Stay hydrated, get plenty of rest, and use over-the-counter medications as needed for comfort."
        
        response_text = f"BRIEF: {brief}\n\nDETAILED: {detailed}"
        
        return AIResponse(
            text=response_text,
            brief_text=brief,
            detailed_text=detailed,
            function_calls=function_calls,
            metadata={
                "assessment_stage": stage,
                "conversation_length": message_count,
                "user_language": user_language,
                "is_mock": True
            }
        )