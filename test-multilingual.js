// Multilingual Voice Integration Test
const API_BASE_URL = 'http://localhost:3001';

const testMessages = {
    'English': {
        message: 'I have a headache and feel nauseous',
        expectedLang: 'en'
    },
    'Korean': {
        message: '머리가 아프고 메스꺼워요',
        expectedLang: 'ko'
    },
    'Japanese': {
        message: '頭が痛くて気分が悪いです',
        expectedLang: 'ja'
    },
    'Spanish': {
        message: 'Tengo dolor de cabeza y náuseas',
        expectedLang: 'es'
    }
};

async function testLanguage(lang, testData) {
    console.log(`\n📤 Testing ${lang} message: "${testData.message}"`);
    
    try {
        const formData = new FormData();
        formData.append('text', testData.message);
        
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Response received');
            
            const responseText = data.advice || data.response || 'No response text';
            console.log(`📝 Response preview: ${responseText.substring(0, 100)}...`);
            
            // Basic language detection check
            if (testData.expectedLang === 'ko' && /[가-힣]/.test(responseText)) {
                console.log('✅ Korean response detected correctly');
            } else if (testData.expectedLang === 'ja' && /[ひらがなカタカナ一-龯]/.test(responseText)) {
                console.log('✅ Japanese response detected correctly');
            } else if (testData.expectedLang === 'es' && /dolor|cabeza|médico|ayuda/.test(responseText)) {
                console.log('✅ Spanish response detected correctly');
            } else if (testData.expectedLang === 'en') {
                console.log('✅ English response (default)');
            } else {
                console.log('⚠️ Language detection may need verification');
            }
        } else {
            console.log(`❌ HTTP Error: ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ Error testing ${lang}: ${error.message}`);
    }
}

async function runTests() {
    console.log('🌍 Testing Multilingual Voice Integration');
    console.log('=========================================');
    
    console.log('\n🔍 Testing Backend Language Detection...');
    
    for (const [lang, testData] of Object.entries(testMessages)) {
        await testLanguage(lang, testData);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
    }
    
    console.log('\n🎤 Voice Recognition Test Instructions:');
    console.log('1. Open http://localhost:5173/test-voice-integration.html');
    console.log('2. Select different languages from the dropdown');
    console.log('3. Click "Start Listening" and speak in the selected language');
    console.log('4. Verify that speech recognition works in each language');
    console.log('5. Test TTS by clicking "Send + Speak Response"');
    
    console.log('\n🔊 TTS Test Instructions:');
    console.log('1. Enter text in different languages in the message box');
    console.log('2. Click "Test TTS Only" to hear the text spoken');
    console.log('3. Verify natural speech in each language');
    
    console.log('\n📱 Main App Test Instructions:');
    console.log('1. Open http://localhost:5173');
    console.log('2. Use the language selector in the header (🌍 dropdown)');
    console.log('3. Test voice input in different languages');
    console.log('4. Verify responses are in the same language as input');
    
    console.log('\n✅ Multilingual test setup complete!');
    console.log('🌍 Supported languages: English, 한국어, 日本語, Español');
}

// Check if running in Node.js environment
if (typeof window === 'undefined') {
    // Node.js environment - use node-fetch
    const fetch = require('node-fetch');
    const { FormData } = require('formdata-node');
    runTests().catch(console.error);
} else {
    // Browser environment
    runTests().catch(console.error);
}