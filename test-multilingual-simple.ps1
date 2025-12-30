#!/usr/bin/env pwsh

# Simple Multilingual Test Script
Write-Host "Testing Multilingual Voice Integration" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

$API_BASE_URL = "http://localhost:3001"

# Test English message
Write-Host "`nTesting English message..." -ForegroundColor Yellow
try {
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $message = "I have a headache and feel nauseous"
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"text`"$LF",
        $message,
        "--$boundary--$LF"
    ) -join $LF
    
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/chat" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary"
    
    if ($response) {
        Write-Host "English test: SUCCESS" -ForegroundColor Green
        $responseText = $response.advice -or $response.response -or "No response"
        Write-Host "Response preview: $($responseText.Substring(0, [Math]::Min(80, $responseText.Length)))..." -ForegroundColor White
    }
} catch {
    Write-Host "English test: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Korean message
Write-Host "`nTesting Korean message..." -ForegroundColor Yellow
try {
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $message = "머리가 아프고 메스꺼워요"
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"text`"$LF",
        $message,
        "--$boundary--$LF"
    ) -join $LF
    
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/chat" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary"
    
    if ($response) {
        Write-Host "Korean test: SUCCESS" -ForegroundColor Green
        $responseText = $response.advice -or $response.response -or "No response"
        Write-Host "Response preview: $($responseText.Substring(0, [Math]::Min(80, $responseText.Length)))..." -ForegroundColor White
        
        # Check if response contains Korean characters
        if ($responseText -match "[가-힣]") {
            Write-Host "Korean response detected: YES" -ForegroundColor Green
        } else {
            Write-Host "Korean response detected: NO (may be in English)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Korean test: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest Instructions:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:5173 for main app" -ForegroundColor White
Write-Host "2. Open http://localhost:5173/test-voice-integration.html for voice test" -ForegroundColor White
Write-Host "3. Use language selector to test different languages" -ForegroundColor White
Write-Host "4. Test voice input and TTS in each language" -ForegroundColor White

Write-Host "`nMultilingual features implemented:" -ForegroundColor Green
Write-Host "- Language detection in backend AI service" -ForegroundColor White
Write-Host "- Multilingual speech recognition" -ForegroundColor White
Write-Host "- Language-specific TTS voice selection" -ForegroundColor White
Write-Host "- ElevenLabs multilingual model support" -ForegroundColor White
Write-Host "- Language preference storage" -ForegroundColor White