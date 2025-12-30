#!/usr/bin/env python3
"""Test language detection function"""

import re

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

# Test cases
test_cases = [
    "머리가 아파요",
    "I have a headache", 
    "頭が痛いです",
    "Me duele la cabeza"
]

for text in test_cases:
    detected = detect_language(text)
    has_hangul = bool(re.search(r'[가-힣ㄱ-ㅎㅏ-ㅣ]', text))
    print(f"Text: '{text}' -> Language: {detected}, Has Hangul: {has_hangul}")
    
    # Character analysis
    for char in text:
        if ord(char) > 127:
            print(f"  Non-ASCII char: '{char}' (U+{ord(char):04X})")