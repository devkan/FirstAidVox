#!/usr/bin/env pwsh

# Multilingual Voice Integration Test Script
# Tests voice recognition and TTS in multiple languages

Write-Host "🌍 Testing Multilingual Voice Integration" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$API_BASE_URL = "http://localhost:3001"

# Test messages in different languages
$testMessages = @{
    "English" = @{
        "message" = "I have a headache and feel nauseous"
        "expected_lang" = "en"
    }
    "Korean" = @{
        "message" = "머리가 아프고 메스꺼워요"
        "expected_lang" = "ko"
    }
    "Japanese" = @{
        "message" = "頭が痛くて気分が悪いです"
        "expected_lang" = "ja"
    }
    "Spanish" = @{
        "message" = "Tengo dolor de cabeza y náuseas"
        "expected_lang" = "es"
    }
}

Write-Host "`n🔍 Testing Backend Language Detection..." -ForegroundColor Yellow

foreach ($lang in $testMessages.Keys) {
    $testData = $testMessages[$lang]
    $message = $testData.message
    $expectedLang = $testData.expected_lang
    
    Write-Host "`n📤 Testing $lang message: '$message'" -ForegroundColor Cyan
    
    try {
        # Create form data
        $boundary = [System.Guid]::NewGuid().ToString()
        $LF = "`r`n"
        $bodyLines = (
            "--$boundary",
            "Content-Disposition: form-data; name=`"text`"$LF",
            $message,
            "--$boundary--$LF"
        ) -join $LF
        
        # Send request
        $response = Invoke-RestMethod -Uri "$API_BASE_URL/chat" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary"
        
        if ($response) {
            Write-Host "✅ Response received" -ForegroundColor Green
            
            # Check if response is in the same language
            $responseText = $response.advice -or $response.response -or "No response text"
            Write-Host "📝 Response preview: $($responseText.Substring(0, [Math]::Min(100, $responseText.Length)))..." -ForegroundColor White
            
            # Basic language detection check
            if ($expectedLang -eq "ko" -and $responseText -match "[가-힣]") {
                Write-Host "✅ Korean response detected correctly" -ForegroundColor Green
            } elseif ($expectedLang -eq "ja" -and $responseText -match "[ひらがなカタカナ一-龯]") {
                Write-Host "✅ Japanese response detected correctly" -ForegroundColor Green
            } elseif ($expectedLang -eq "es" -and ($responseText -match "dolor|cabeza|médico|ayuda")) {
                Write-Host "✅ Spanish response detected correctly" -ForegroundColor Green
            } elseif ($expectedLang -eq "en") {
                Write-Host "✅ English response (default)" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Language detection may need verification" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ No response received" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error testing $lang`: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`n🎤 Voice Recognition Test Instructions:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:5173/test-voice-integration.html" -ForegroundColor White
Write-Host "2. Select different languages from the dropdown" -ForegroundColor White
Write-Host "3. Click 'Start Listening' and speak in the selected language" -ForegroundColor White
Write-Host "4. Verify that speech recognition works in each language" -ForegroundColor White
Write-Host "5. Test TTS by clicking 'Send + Speak Response'" -ForegroundColor White

Write-Host "`n🔊 TTS Test Instructions:" -ForegroundColor Yellow
Write-Host "1. Enter text in different languages in the message box" -ForegroundColor White
Write-Host "2. Click 'Test TTS Only' to hear the text spoken" -ForegroundColor White
Write-Host "3. Verify natural speech in each language" -ForegroundColor White

Write-Host "`n📱 Main App Test Instructions:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:5173" -ForegroundColor White
Write-Host "2. Use the language selector in the header (🌍 dropdown)" -ForegroundColor White
Write-Host "3. Test voice input in different languages" -ForegroundColor White
Write-Host "4. Verify responses are in the same language as input" -ForegroundColor White

Write-Host "`n✅ Multilingual test setup complete!" -ForegroundColor Green
Write-Host "🌍 Supported languages: English, 한국어, 日本語, Español" -ForegroundColor Green