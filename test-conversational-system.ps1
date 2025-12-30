# Test the conversational medical system
Write-Host "=== Testing Conversational Medical System ===" -ForegroundColor Green

# Test 1: Initial Korean message
Write-Host "`n1. Testing initial Korean message..." -ForegroundColor Yellow
$body1 = @{
    message = "머리 아파, 열도 나는거 같애"
    conversation_history = @()
} | ConvertTo-Json -Depth 3

try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body1 -ContentType "application/json" -TimeoutSec 15
    Write-Host "✅ Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response1.assessment_stage)"
    Write-Host "Response: $($response1.response)"
    Write-Host ""
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Follow-up message
Write-Host "2. Testing follow-up message..." -ForegroundColor Yellow
$body2 = @{
    message = "어제부터, 목도 아프고 기침도 나, 38도"
    conversation_history = @(
        @{ role = "user"; content = "머리 아파, 열도 나는거 같애" }
        @{ role = "assistant"; content = $response1.response }
    )
} | ConvertTo-Json -Depth 3

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body2 -ContentType "application/json" -TimeoutSec 15
    Write-Host "✅ Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response2.assessment_stage)"
    Write-Host "Response: $($response2.response)"
    Write-Host ""
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Third message to trigger final diagnosis
Write-Host "3. Testing third message for final diagnosis..." -ForegroundColor Yellow
$body3 = @{
    message = "기침이 계속 나고 가래도 좀 나와"
    conversation_history = @(
        @{ role = "user"; content = "머리 아파, 열도 나는거 같애" }
        @{ role = "assistant"; content = $response1.response }
        @{ role = "user"; content = "어제부터, 목도 아프고 기침도 나, 38도" }
        @{ role = "assistant"; content = $response2.response }
    )
} | ConvertTo-Json -Depth 3

try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body3 -ContentType "application/json" -TimeoutSec 15
    Write-Host "✅ Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response3.assessment_stage)"
    Write-Host "Response: $($response3.response)"
    Write-Host ""
    
    # Check if final diagnosis includes required elements
    $finalResponse = $response3.response.ToLower()
    $hasHospitalInfo = $finalResponse.Contains("병원") -or $finalResponse.Contains("hospital")
    $hasPharmacyInfo = $finalResponse.Contains("약국") -or $finalResponse.Contains("pharmacy")
    $hasEmergencyInfo = $finalResponse.Contains("119") -or $finalResponse.Contains("911") -or $finalResponse.Contains("응급")
    $hasEndingPhrase = $finalResponse.Contains("상담이 완료") -or $finalResponse.Contains("consultation completed")
    
    Write-Host "=== Final Diagnosis Analysis ===" -ForegroundColor Cyan
    Write-Host "Hospital info: $(if($hasHospitalInfo){'YES'}else{'NO'})"
    Write-Host "Pharmacy info: $(if($hasPharmacyInfo){'YES'}else{'NO'})"
    Write-Host "Emergency info: $(if($hasEmergencyInfo){'YES'}else{'NO'})"
    Write-Host "Ending phrase: $(if($hasEndingPhrase){'YES'}else{'NO'})"
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green