# Test the conversational medical system with English
Write-Host "=== Testing Conversational Medical System (English) ===" -ForegroundColor Green

# Test 1: Initial English message
Write-Host "`n1. Testing initial English message..." -ForegroundColor Yellow
$body1 = @{
    message = "I have a headache and feel feverish"
    conversation_history = @()
} | ConvertTo-Json -Depth 3

try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body1 -ContentType "application/json" -TimeoutSec 15
    Write-Host "Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response1.assessment_stage)"
    Write-Host "Response: $($response1.response)"
    Write-Host ""
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Follow-up message
Write-Host "2. Testing follow-up message..." -ForegroundColor Yellow
$body2 = @{
    message = "Started yesterday, also have sore throat and cough, fever is 38C"
    conversation_history = @(
        @{ role = "user"; content = "I have a headache and feel feverish" }
        @{ role = "assistant"; content = $response1.response }
    )
} | ConvertTo-Json -Depth 3

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body2 -ContentType "application/json" -TimeoutSec 15
    Write-Host "Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response2.assessment_stage)"
    Write-Host "Response: $($response2.response)"
    Write-Host ""
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Third message to trigger final diagnosis
Write-Host "3. Testing third message for final diagnosis..." -ForegroundColor Yellow
$body3 = @{
    message = "The cough is persistent and I have some phlegm"
    conversation_history = @(
        @{ role = "user"; content = "I have a headache and feel feverish" }
        @{ role = "assistant"; content = $response1.response }
        @{ role = "user"; content = "Started yesterday, also have sore throat and cough, fever is 38C" }
        @{ role = "assistant"; content = $response2.response }
    )
} | ConvertTo-Json -Depth 3

try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body3 -ContentType "application/json" -TimeoutSec 15
    Write-Host "Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response3.assessment_stage)"
    Write-Host "Response: $($response3.response)"
    Write-Host ""
    
    # Check if final diagnosis includes required elements (check response2, not response3)
    $finalResponse = $response2.response.ToLower()
    $hasHospitalInfo = $finalResponse.Contains("hospital") -or $finalResponse.Contains("doctor")
    $hasPharmacyInfo = $finalResponse.Contains("pharmacy") -or $finalResponse.Contains("medication")
    $hasEmergencyInfo = $finalResponse.Contains("911") -or $finalResponse.Contains("emergency")
    $hasEndingPhrase = $finalResponse.Contains("consultation completed") -or $finalResponse.Contains("assessment complete")
    
    Write-Host "=== Final Diagnosis Analysis ===" -ForegroundColor Cyan
    Write-Host "Hospital info: $(if($hasHospitalInfo){'YES'}else{'NO'})"
    Write-Host "Pharmacy info: $(if($hasPharmacyInfo){'YES'}else{'NO'})"
    Write-Host "Emergency info: $(if($hasEmergencyInfo){'YES'}else{'NO'})"
    Write-Host "Ending phrase: $(if($hasEndingPhrase){'YES'}else{'NO'})"
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green