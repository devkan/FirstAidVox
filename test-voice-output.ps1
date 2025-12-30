# Test voice output functionality
Write-Host "=== Testing Voice Output ===" -ForegroundColor Green

# Test conversational response structure
Write-Host "`n1. Testing conversational response structure..." -ForegroundColor Yellow
$body = @{
    message = "I have a headache"
    conversation_history = @()
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
    
    Write-Host "✅ Response received" -ForegroundColor Green
    Write-Host "Response fields:" -ForegroundColor Cyan
    Write-Host "  - response: $(if($response.response){'YES - ' + $response.response.Length + ' chars'}else{'NO'})"
    Write-Host "  - brief_text: $(if($response.brief_text){'YES - ' + $response.brief_text.Length + ' chars'}else{'NO'})"
    Write-Host "  - detailed_text: $(if($response.detailed_text){'YES - ' + $response.detailed_text.Length + ' chars'}else{'NO'})"
    
    if ($response.brief_text) {
        Write-Host "`nBrief text sample:" -ForegroundColor Yellow
        Write-Host $response.brief_text.Substring(0, [Math]::Min(100, $response.brief_text.Length)) + "..."
    }
    
    if ($response.response) {
        Write-Host "`nFull response sample:" -ForegroundColor Yellow
        Write-Host $response.response.Substring(0, [Math]::Min(100, $response.response.Length)) + "..."
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Voice Output Analysis ===" -ForegroundColor Cyan
Write-Host "For voice output to work properly:" -ForegroundColor Yellow
Write-Host "  1. brief_text should be available for TTS" -ForegroundColor White
Write-Host "  2. If brief_text is empty, response should be used as fallback" -ForegroundColor White
Write-Host "  3. Voice agent should be active in frontend" -ForegroundColor White

Write-Host "`n=== Recommendations ===" -ForegroundColor Green
if ($response.brief_text) {
    Write-Host "✅ brief_text is available - voice output should work" -ForegroundColor Green
} else {
    Write-Host "⚠️  brief_text is missing - using response as fallback" -ForegroundColor Yellow
}

Write-Host "`n📝 To test voice output in frontend:" -ForegroundColor Cyan
Write-Host "  1. Open the application in browser" -ForegroundColor White
Write-Host "  2. Click the microphone button to activate voice agent" -ForegroundColor White
Write-Host "  3. Send a message and check if TTS plays" -ForegroundColor White
Write-Host "  4. Check browser console for voice-related logs" -ForegroundColor White