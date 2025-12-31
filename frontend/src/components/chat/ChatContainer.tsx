import React, { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { EmergencyButton } from './EmergencyButton';
import { ConversationProgress } from './ConversationProgress';
import { useMedicalState } from '../../hooks/useAppState';
import { useVoiceAgent } from '../../hooks/useVoiceAgent';
import { conversationalService } from '../../services/conversationalService';
import type { ChatMessage, ChatContainerProps } from './types';

export const ChatContainer = React.memo(function ChatContainer({ className = '' }: ChatContainerProps) {
  const medicalState = useMedicalState();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);

  const voiceAgent = useVoiceAgent({
    autoConnect: false,
    pendingImage,
    onImageSent: () => setPendingImage(null)
  });

  // Track if welcome TTS has been played
  const welcomeTTSPlayedRef = useRef(false);
  
  // Initialize conversation on first load
  useEffect(() => {
    if (!conversationStarted) {
      conversationalService.startNewConversation();
      setConversationStarted(true);
      
      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: 'welcome-msg',
        content: "Hello! I'm your medical triage assistant. I'll help assess your symptoms through a series of questions. What's your main concern today?",
        type: 'text',
        timestamp: new Date(),
        isUser: false,
        metadata: {
          isWelcome: true,
          assessment_stage: 'initial'
        }
      };
      setMessages([welcomeMessage]);
      
      // Play welcome TTS after user's first interaction (click/touch)
      // Browser blocks autoplay without user interaction
      const playWelcomeTTS = () => {
        if (!welcomeTTSPlayedRef.current) {
          welcomeTTSPlayedRef.current = true;
          const welcomeText = "Hello! I'm your medical triage assistant. I'll help assess your symptoms. What's your main concern today?";
          playBrowserTTS(welcomeText).catch(err => {
            console.log('Welcome TTS error (non-blocking):', err);
          });
          // Remove listeners after playing
          document.removeEventListener('click', playWelcomeTTS);
          document.removeEventListener('touchstart', playWelcomeTTS);
        }
      };
      
      document.addEventListener('click', playWelcomeTTS, { once: true });
      document.addEventListener('touchstart', playWelcomeTTS, { once: true });
    }
  }, [conversationStarted]);

  // Convert conversation history to chat messages
  // NOTE: This effect handles syncing conversationalService messages to chat UI
  // It triggers on medical assessment changes AND periodically to catch voice messages
  // 🔧 OPTIMIZED: Reduced sync frequency and added change detection to prevent flickering
  const lastSyncedCountRef = useRef(0);
  
  useEffect(() => {
    const syncMessages = () => {
      const conversation = conversationalService.getCurrentConversation();
      if (!conversation) return;

      // Check if conversation has new messages we haven't synced yet
      const conversationMsgCount = conversation.messages.length;
      
      // 🔧 OPTIMIZATION: Skip if no new messages since last sync
      if (conversationMsgCount === lastSyncedCountRef.current) {
        return; // No changes, skip sync to prevent flickering
      }

      // Skip if we already have messages with hospital data (they're managed by handleSendMessage)
      // Only run on initial load (messages.length === 0 or just welcome message)
      const hasOnlyWelcome = messages.length === 1 && messages[0]?.id === 'welcome-msg';
      const hasHospitalData = messages.some(msg => (msg.metadata?.hospitalData?.length ?? 0) > 0);
      
      const displayedMsgCount = messages.filter(m => m.id !== 'welcome-msg' && m.type !== 'medical').length;
      const hasNewMessages = conversationMsgCount > displayedMsgCount;
      
      // Don't overwrite messages that have hospital data unless there are new messages
      if (hasHospitalData && !hasNewMessages) {
        return;
      }
      
      const shouldSync = messages.length === 0 || hasOnlyWelcome || hasNewMessages;
      
      if (!shouldSync && !medicalState.currentAssessment) {
        return;
      }

      console.log('📋 Syncing messages from conversationalService:', {
        conversationMsgCount,
        displayedMsgCount,
        hasNewMessages,
        hasHospitalData
      });

      // Update last synced count
      lastSyncedCountRef.current = conversationMsgCount;

      const chatMessages: ChatMessage[] = conversation.messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        type: 'text',
        timestamp: msg.timestamp,
        isUser: msg.role === 'user',
        metadata: {
          ...msg.metadata,
          assessment_stage: msg.metadata?.assessment_stage,
          conversation_stage: conversation.currentStage,
          // Preserve hospital data from message metadata
          hospitalData: msg.metadata?.hospitalData
        }
      }));

      // Add welcome message if no messages yet
      if (chatMessages.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: 'welcome-msg',
          content: "Hello! I'm your medical triage assistant. I'll help assess your symptoms through a series of questions. What's your main concern today?",
          type: 'text',
          timestamp: new Date(),
          isUser: false,
          metadata: {
            isWelcome: true,
            assessment_stage: 'initial'
          }
        };
        chatMessages.unshift(welcomeMessage);
      }

      setMessages(chatMessages);
    };

    // Initial sync
    syncMessages();

    // Set up interval to check for new voice messages (increased to 1 second to reduce flickering)
    const syncInterval = setInterval(syncMessages, 1000);

    return () => clearInterval(syncInterval);
  }, [medicalState.currentAssessment]); // Trigger on medical assessment changes

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle message sending with conversational approach
  const handleSendMessage = async (message: string, attachments?: File[]) => {
    if (!message.trim() && !attachments?.length) return;

    try {
      setIsTyping(true);
      
      // Get the image file if provided
      const imageFile = attachments?.length ? attachments[0] : null;
      
      // Get user location if available
      let userLocation;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false
          });
        });
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (error) {
        console.log('Location not available:', error);
      }

      // Send message through conversational service
      const response = await conversationalService.sendMessage(
        message.trim(),
        userLocation,
        imageFile || undefined
      );

      console.log('📋 Conversational response received:', {
        stage: response.assessment_stage,
        urgency: response.urgency_level,
        confidence: response.confidence,
        hasHospitals: !!response.hospital_data?.length,
        hospitalCount: response.hospital_data?.length || 0
      });

      // Debug: Log hospital details
      if (response.hospital_data?.length) {
        console.log('🏥 Hospital data received from backend:');
        response.hospital_data.forEach((h: any, i: number) => {
          console.log(`  ${i + 1}. ${h.name} (${h.place_type}) - ${h.address} - Lat: ${h.latitude}, Lng: ${h.longitude}`);
        });
      } else {
        console.log('⚠️ No hospital data in response. Stage:', response.assessment_stage);
      }

      // Update medical state if this is a final assessment
      if (response.assessment_stage === 'final' || response.urgency_level !== 'moderate') {
        medicalState.setAssessment({
          condition: response.condition,
          urgencyLevel: response.urgency_level as any,
          advice: response.detailed_text,
          confidence: response.confidence,
          hospitalData: response.hospital_data,
          requiresEmergencyServices: response.urgency_level === 'emergency'
        });
      }

      // Store hospital data for this response to persist it
      const currentHospitalData = response.hospital_data;
      console.log('💾 Storing hospital data for message update:', {
        hasData: !!currentHospitalData,
        count: currentHospitalData?.length || 0
      });

      // FIRST: Update messages immediately (before TTS) so text appears first
      const updatedConversation = conversationalService.getCurrentConversation();
      if (updatedConversation) {
        const chatMessages: ChatMessage[] = updatedConversation.messages.map((msg, index) => {
          // Check if this is the latest assistant message
          const isLatestAssistantMessage = msg.role === 'assistant' && 
            index === updatedConversation.messages.length - 1;
          
          // Debug log for hospital data assignment
          if (isLatestAssistantMessage) {
            console.log('🔄 Assigning hospital data to latest AI message:', {
              msgId: msg.id,
              hasCurrentHospitalData: !!currentHospitalData,
              hasMetadataHospitalData: !!msg.metadata?.hospitalData,
              willUseCurrentData: !!(isLatestAssistantMessage && currentHospitalData)
            });
          }
          
          return {
            id: msg.id,
            content: msg.content,
            type: 'text',
            timestamp: msg.timestamp,
            isUser: msg.role === 'user',
            metadata: {
              ...msg.metadata,
              assessment_stage: msg.metadata?.assessment_stage,
              conversation_stage: updatedConversation.currentStage,
              // Add hospital data to the latest AI message if available
              hospitalData: isLatestAssistantMessage && currentHospitalData ? currentHospitalData : msg.metadata?.hospitalData
            }
          };
        });
        
        // Debug: Check if any message has hospital data
        const messagesWithHospitals = chatMessages.filter(m => (m.metadata?.hospitalData?.length ?? 0) > 0);
        console.log('📊 Messages with hospital data after update:', messagesWithHospitals.length);
        
        setMessages(chatMessages);
      }

      // THEN: Play TTS asynchronously (don't await - let it play in background)
      // For diagnosis (final stage), use detailed_text directly (it's the natural explanation)
      // For other stages, use brief_text
      let textToSpeak = response.brief_text || response.response || '';
      
      // If this is a final diagnosis, use detailed_text directly
      // detailed_text contains the natural, human-friendly explanation
      const isFinalDiagnosis = response.assessment_stage === 'final' || 
                               response.assessment_stage === 'completed';
      
      if (isFinalDiagnosis && response.detailed_text) {
        // Use detailed_text directly for TTS - it's already the natural explanation
        textToSpeak = response.detailed_text;
        console.log('🔊 Using detailed_text directly for TTS (final diagnosis)');
      }
      
      // Only play TTS if there's text to speak
      if (textToSpeak.trim()) {
        // For final diagnosis, use detailed_text as-is (just clean it up)
        // For other messages, convert to natural speech
        let naturalSpeech: string;
        
        if (isFinalDiagnosis && response.detailed_text) {
          // Clean up detailed_text and read the full content for final diagnosis
          naturalSpeech = textToSpeak
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/#{1,6}\s/g, '')
            .replace(/BRIEF:|DETAILED:/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            // Remove function call patterns like search_hospitals("내과", "이비인후과")
            .replace(/search_hospitals\s*\([^)]*\)/gi, '')
            .replace(/\w+_\w+\s*\([^)]*\)/g, '') // Remove any function_name() patterns
            .trim();
          
          // For final diagnosis, read the full detailed_text (no sentence limit)
          // Add closing message in the appropriate language
          const detectedLang = detectLanguageForTTS(naturalSpeech);
          if (detectedLang === 'ko-KR') {
            naturalSpeech += ' 자세한 내용과 근처 병원 정보는 화면을 확인해 주세요.';
          } else if (detectedLang === 'ja-JP') {
            naturalSpeech += ' 詳細と近くの病院情報は画面でご確認ください。';
          } else if (detectedLang === 'es-ES') {
            naturalSpeech += ' Consulte la pantalla para más detalles e información de hospitales cercanos.';
          } else {
            naturalSpeech += ' Please check the screen for nearby hospital information.';
          }
        } else {
          naturalSpeech = convertToNaturalSpeech(textToSpeak);
        }
        
        console.log('🔊 Playing natural TTS:', naturalSpeech.substring(0, 100) + '...');
        
        // Play TTS without blocking - fire and forget
        playBrowserTTS(naturalSpeech).catch(err => {
          console.log('Voice TTS error (non-blocking):', err);
        });
      }
      
    } catch (error) {
      console.error('Failed to send conversational message:', error);
      
      // Add error message to conversation
      conversationalService.addMessage('assistant', 
        'I apologize, but I encountered an error. Please try again or seek immediate medical attention if this is an emergency.'
      );
    } finally {
      setIsTyping(false);
    }
  };

  // Handle voice input with conversational approach
  const handleVoiceInput = async () => {
    try {
      if (voiceAgent.isActive) {
        await voiceAgent.deactivate();
      } else {
        await voiceAgent.activate();
      }
    } catch (error) {
      console.error('Voice input error:', error);
    }
  };

  // Handle emergency call
  const handleEmergencyCall = () => {
    // Emergency contacts logic would go here
    window.open('tel:911', '_self');
  };

  // Detect language from text for TTS
  const detectLanguageForTTS = (text: string): string => {
    // Korean detection - check for Korean characters
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)) {
      return 'ko-KR';
    }
    // Japanese detection - check for Japanese characters
    if (/[ひ-ゖヰ-ヺカ-ヿ一-龯ァ-ヴ]/.test(text)) {
      return 'ja-JP';
    }
    // Spanish detection - use words that are ONLY Spanish (not shared with English)
    // Avoid words like "hospital" which exist in both languages
    const spanishOnlyWords = ['dolor', 'cabeza', 'fiebre', 'médico', 'emergencia', 'síntomas', 'enfermo', 'ayuda', 'necesito', 'tengo'];
    const lowerText = text.toLowerCase();
    if (spanishOnlyWords.some(word => lowerText.includes(word))) {
      return 'es-ES';
    }
    // Default to English
    return 'en-US';
  };

  // Convert formal text to natural speech (human-like summary)
  const convertToNaturalSpeech = (text: string): string => {
    const lang = detectLanguageForTTS(text);
    
    // Clean markdown formatting first
    let cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/BRIEF:|DETAILED:/g, '')
      .trim();

    // Check if this is a final diagnosis (contains diagnosis keywords)
    const isDiagnosis = /진단[:\s]|Diagnosis[:\s]|診断[:\s]|Diagnóstico[:\s]/i.test(cleanText);
    
    if (isDiagnosis) {
      // Extract key information for natural speech
      if (lang === 'ko-KR') {
        // Korean: Prioritize "추가 정보" section for natural speech
        const additionalInfoMatch = cleanText.match(/추가\s*정보[:\s]*(.+?)(?:$|(?=\n\n|\*\*|진단:|병원:|약국:|응급:))/is);
        
        if (additionalInfoMatch && additionalInfoMatch[1]) {
          let additionalInfo = additionalInfoMatch[1].trim();
          additionalInfo = additionalInfo
            .replace(/\*\*/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Take first 2-3 sentences if too long
          const sentences = additionalInfo.split(/(?<=[.!?。])\s*/);
          if (sentences.length > 3) {
            additionalInfo = sentences.slice(0, 3).join(' ');
          }
          
          if (additionalInfo.length > 0) {
            return additionalInfo + ' 자세한 내용은 화면을 확인해 주세요.';
          }
        }
        
        // Fallback: Korean natural speech conversion for diagnosis
        const diagnosisMatch = cleanText.match(/진단[:\s]*([^\n*]+)/i);
        const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : '';
        
        if (diagnosis) {
          return `${diagnosis}으로 보입니다. 자세한 치료 방법과 근처 병원 정보는 화면을 확인해 주세요.`;
        }
      } else if (lang === 'ja-JP') {
        const diagnosisMatch = cleanText.match(/診断[:\s]*([^\n*]+)/i);
        const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : '';
        
        if (diagnosis) {
          return `${diagnosis}の可能性があります。詳しい情報は画面でご確認ください。`;
        }
      } else if (lang === 'es-ES') {
        const diagnosisMatch = cleanText.match(/Diagnóstico[:\s]*([^\n*]+)/i);
        const diagnosis = diagnosisMatch ? diagnosisMatch[1].trim() : '';
        
        if (diagnosis) {
          return `Parece ser ${diagnosis}. Consulte la pantalla para más información.`;
        }
      } else {
        // English: Prioritize "Additional Information" section for natural speech
        // This section contains the most human-friendly explanation
        
        // Check if text contains "Additional Information" (case-insensitive)
        const lowerText = cleanText.toLowerCase();
        const additionalInfoIndex = lowerText.indexOf('additional information');
        
        console.log('🔍 Looking for Additional Information in text:', cleanText.substring(0, 200) + '...');
        console.log('🔍 Additional Information index:', additionalInfoIndex);
        
        if (additionalInfoIndex !== -1) {
          // Extract everything after "Additional Information" from original text
          let additionalInfo = cleanText.substring(additionalInfoIndex + 'additional information'.length);
          
          // Clean up the text
          additionalInfo = additionalInfo
            .replace(/^\s*[:\s]*/g, '') // Remove leading colons and spaces
            .replace(/\*\*/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // If Additional Information is too long, take first 2-3 sentences
          if (additionalInfo.length > 0) {
            const sentences = additionalInfo.split(/(?<=[.!?])\s+/);
            if (sentences.length > 3) {
              additionalInfo = sentences.slice(0, 3).join(' ');
            }
            
            console.log('🔊 TTS using Additional Information:', additionalInfo.substring(0, 100) + '...');
            return additionalInfo + ' Please check the screen for detailed care instructions.';
          }
        }
        
        // Fallback: Extract diagnosis name and create natural speech
        let diagnosis = '';
        
        // Pattern 1: "Diagnosis: Something"
        const pattern1 = cleanText.match(/Diagnosis[:\s]+([^.\n*]+)/i);
        if (pattern1) {
          diagnosis = pattern1[1].trim();
        }
        
        // Pattern 2: "This looks like X" or "appears to be X"
        if (!diagnosis) {
          const pattern2 = cleanText.match(/(?:looks like|appears to be|seems to be|likely|probably)[:\s]+([^.\n*]+)/i);
          if (pattern2) {
            diagnosis = pattern2[1].trim();
          }
        }
        
        // Pattern 3: "Upper respiratory infection" or similar condition names
        if (!diagnosis) {
          const pattern3 = cleanText.match(/(?:Upper|Lower|Common|Viral|Bacterial)\s+[a-zA-Z\s]+(?:infection|cold|flu|fever|pain)/i);
          if (pattern3) {
            diagnosis = pattern3[0].trim();
          }
        }
        
        if (diagnosis) {
          // Clean up the diagnosis text
          diagnosis = diagnosis.replace(/^\s*[-:]\s*/, '').trim();
          return `This looks like ${diagnosis}. Please check the screen for detailed care instructions and nearby hospitals.`;
        }
        
        // Fallback: Extract first meaningful sentence about the condition
        const firstSentence = cleanText.split(/[.!]\s/)[0];
        if (firstSentence && firstSentence.length < 100) {
          return `${firstSentence}. Check the screen for more details.`;
        }
      }
    }
    
    // For non-diagnosis messages (questions, clarifications)
    // Summarize the key content naturally
    if (lang === 'ko-KR') {
      // Korean: Extract the main question/request
      // Remove filler phrases and keep the core message
      let summary = cleanText
        .replace(/알겠습니다[.\s]*/g, '')
        .replace(/감사합니다[.\s]*/g, '')
        .replace(/말씀해 주셔서[.\s]*/g, '')
        .replace(/증상을[.\s]*/g, '')
        .trim();
      
      // If it's a question about symptoms, summarize it
      if (summary.includes('언제') || summary.includes('어떤') || summary.includes('있으신가요') || summary.includes('알려주')) {
        // Extract the key question parts
        const hasWhen = summary.includes('언제');
        const hasOther = summary.includes('다른 증상') || summary.includes('동반');
        const hasSeverity = summary.includes('정도') || summary.includes('심한');
        
        let naturalQuestion = '';
        if (hasWhen && hasOther) {
          naturalQuestion = '언제부터 아프셨고, 다른 증상도 있으신지 알려주세요.';
        } else if (hasWhen) {
          naturalQuestion = '언제부터 증상이 시작되었나요?';
        } else if (hasSeverity) {
          naturalQuestion = '증상이 얼마나 심하신가요?';
        } else if (hasOther) {
          naturalQuestion = '다른 증상도 있으신가요?';
        } else {
          // Keep first meaningful sentence
          naturalQuestion = summary.split(/[.?!]\s*/)[0] + '?';
        }
        return naturalQuestion;
      }
      
      // Default: return cleaned text (max 150 chars)
      return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
      
    } else if (lang === 'ja-JP') {
      let summary = cleanText
        .replace(/ありがとうございます[。\s]*/g, '')
        .replace(/わかりました[。\s]*/g, '')
        .trim();
      
      return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
      
    } else if (lang === 'es-ES') {
      let summary = cleanText
        .replace(/Entiendo[.\s]*/gi, '')
        .replace(/Gracias[.\s]*/gi, '')
        .trim();
      
      return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
      
    } else {
      // English: Remove filler and summarize
      let summary = cleanText
        .replace(/I understand[.\s]*/gi, '')
        .replace(/Thank you[.\s]*/gi, '')
        .replace(/I see[.\s]*/gi, '')
        .replace(/Based on your symptoms[,.\s]*/gi, '')
        .trim();
      
      // If asking questions, keep them natural
      if (summary.includes('?')) {
        // Extract questions and combine them naturally
        const questions = summary.match(/[^.!?]*\?/g);
        if (questions && questions.length > 0) {
          // Take first 2 questions max and clean them up
          const cleanQuestions = questions.slice(0, 2).map(q => q.trim()).join(' ');
          return cleanQuestions;
        }
      }
      
      // For statements, extract the key message
      const sentences = summary.split(/[.!]\s+/);
      if (sentences.length > 0) {
        // Take first 1-2 meaningful sentences
        const keyMessage = sentences.slice(0, 2).join('. ').trim();
        return keyMessage.length > 150 ? keyMessage.substring(0, 150) + '...' : keyMessage;
      }
      
      return summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
    }
  };

  // Browser TTS fallback function with proper language detection
  const playBrowserTTS = async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        // Check if Speech Synthesis is supported
        if (!('speechSynthesis' in window)) {
          console.warn('Speech Synthesis not supported in this browser');
          resolve();
          return;
        }

        // Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        // Clean text for TTS - remove markdown formatting
        const cleanText = text
          .replace(/\*\*/g, '') // Remove bold markers
          .replace(/\*/g, '')   // Remove italic markers
          .replace(/#{1,6}\s/g, '') // Remove headers
          .replace(/BRIEF:|DETAILED:/g, '') // Remove section markers
          .trim();

        if (!cleanText) {
          resolve();
          return;
        }

        // Detect language from text content
        const detectedLang = detectLanguageForTTS(cleanText);
        console.log('🔊 Detected language for TTS:', detectedLang);

        // Create speech utterance
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Configure voice settings based on language
        utterance.lang = detectedLang;
        
        // Adjust rate for more natural speech
        // Korean needs slower rate for more natural flow
        if (detectedLang === 'ko-KR') {
          utterance.rate = 0.85; // Slower for Korean
          utterance.pitch = 1.0;
        } else if (detectedLang === 'ja-JP') {
          utterance.rate = 0.85;
          utterance.pitch = 1.0;
        } else {
          utterance.rate = 0.9; // English and others
          utterance.pitch = 1.0;
        }
        utterance.volume = 0.9;

        // Try to find the best voice for the detected language
        const voices = window.speechSynthesis.getVoices();
        
        // For Korean, prefer Google or Microsoft voices which sound more natural
        let matchingVoice = null;
        if (detectedLang === 'ko-KR') {
          // Priority: Google Korean > Microsoft Korean > Any Korean
          matchingVoice = voices.find(voice => 
            voice.lang.startsWith('ko') && voice.name.toLowerCase().includes('google')
          ) || voices.find(voice => 
            voice.lang.startsWith('ko') && voice.name.toLowerCase().includes('microsoft')
          ) || voices.find(voice => 
            voice.lang.startsWith('ko')
          );
        } else {
          matchingVoice = voices.find(voice => voice.lang.startsWith(detectedLang.split('-')[0]));
        }
        
        if (matchingVoice) {
          utterance.voice = matchingVoice;
          console.log('🔊 Using voice:', matchingVoice.name, matchingVoice.lang);
        } else {
          console.log('🔊 No matching voice found, using default for:', detectedLang);
        }

        // Set up event handlers
        utterance.onend = () => {
          console.log('🔊 Browser TTS playback completed');
          resolve();
        };
        
        utterance.onerror = (event) => {
          console.error('🔊 Browser TTS error:', event.error);
          resolve();
        };

        utterance.onstart = () => {
          console.log('🔊 Browser TTS playback started for language:', detectedLang);
        };

        // Start speaking
        window.speechSynthesis.speak(utterance);
        
        // Safety timeout - much longer to allow full speech (5 minutes max)
        // Don't cancel speech, just resolve the promise
        const safetyTimeout = setTimeout(() => {
          console.log('🔊 TTS safety timeout reached, but not canceling speech');
          resolve();
        }, 300000); // 5 minutes max

        // Clear timeout when speech ends naturally
        utterance.onend = () => {
          clearTimeout(safetyTimeout);
          console.log('🔊 Browser TTS playback completed naturally');
          resolve();
        };
        
      } catch (error) {
        console.error('🔊 Browser TTS initialization error:', error);
        resolve();
      }
    });
  };

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-br from-medical-50 to-chat-background ${className}`}>
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-chat-border safe-area-top">
        <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-medical-500 to-medical-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-gray-900">FirstAidVox</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden xs:block">AI Medical Assistant</p>
              </div>
            </div>
            
            {/* Status and Language Selection */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Language Selection */}
              <select
                value={voiceAgent.getLanguagePreference()}
                onChange={(e) => voiceAgent.setLanguagePreference(e.target.value)}
                className="text-xs sm:text-sm bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                title="Select voice recognition language"
              >
                <option value="auto">🌍 Auto</option>
                <option value="en-US">🇺🇸 English</option>
                <option value="ko-KR">🇰🇷 한국어</option>
                <option value="ja-JP">🇯🇵 日本語</option>
                <option value="es-ES">🇪🇸 Español</option>
              </select>
              
              {/* Status indicators */}
              {medicalState.isProcessing && (
                <div className="flex items-center space-x-1 sm:space-x-2 text-medical-600">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-medical-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">Analyzing...</span>
                </div>
              )}
              
              {voiceAgent.isActive && (
                <div className="flex items-center space-x-1 sm:space-x-2 text-safe-600">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-safe-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">
                    {voiceAgent.isListening ? 'Listening...' : 'Voice Ready'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto chat-scrollbar px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto space-y-3 sm:space-y-4">
            
            {/* Conversation Progress Tracker */}
            <ConversationProgress className="sticky top-0 z-10" />
            
            {messages.length === 0 ? (
              // Welcome message
              <div className="text-center py-8 sm:py-12">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-medical-500 to-medical-600 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Welcome to FirstAidVox</h2>
                <p className="text-sm sm:text-base text-gray-600 max-w-xs sm:max-w-md mx-auto px-4">
                  I'm your AI medical assistant. Describe your symptoms or ask any health-related questions to get started. I can respond in English, 한국어, 日本語, or Español.
                </p>
                <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2 px-4">
                  <button 
                    onClick={() => handleSendMessage("I have a headache")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "I have a headache"
                  </button>
                  <button 
                    onClick={() => handleSendMessage("머리가 아파요")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "머리가 아파요"
                  </button>
                  <button 
                    onClick={() => handleSendMessage("I feel dizzy")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "I feel dizzy"
                  </button>
                  <button 
                    onClick={() => handleSendMessage("First aid for cuts")}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-medical-100 text-medical-700 rounded-full text-xs sm:text-sm hover:bg-medical-200 transition-colors"
                  >
                    "First aid for cuts"
                  </button>
                </div>
              </div>
            ) : (
              // Messages list
              messages.map((message) => (
                <div key={message.id} className="message-enter">
                  <MessageBubble message={message} />
                </div>
              ))
            )}

            {/* Typing indicator */}
            <TypingIndicator isVisible={isTyping || medicalState.isProcessing} />

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onVoiceInput={handleVoiceInput}
        disabled={medicalState.isProcessing}
        placeholder="Describe your symptoms or ask a medical question... (English, 한국어, 日본語, Español)"
        className="flex-shrink-0 safe-area-bottom"
      />

      {/* Emergency Button */}
      <EmergencyButton
        onEmergencyCall={handleEmergencyCall}
        className="fixed bottom-48 right-3 sm:bottom-52 sm:right-4 lg:bottom-56 lg:right-6 z-50"
      />
    </div>
  );
});