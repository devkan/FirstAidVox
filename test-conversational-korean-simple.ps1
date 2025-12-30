# Test Korean conversational system with UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== Testing Korean Conversational System ===" -ForegroundColor Green

# Test 1: Initial Korean message
Write-Host "`n1. Testing initial Korean message..." -ForegroundColor Yellow
$body1 = @{
    message = "머리 아파"
    conversation_history = @()
} | ConvertTo-Json -Depth 3

try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body1 -ContentType "application/json; charset=utf-8" -TimeoutSec 15
    Write-Host "Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response1.assessment_stage)"
    Write-Host "Response: $($response1.response)"
    Write-Host ""
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Follow-up message to trigger final diagnosis
Write-Host "2. Testing follow-up message..." -ForegroundColor Yellow
$body2 = @{
    message = "어제부터 열도 나고 목도 아파"
    conversation_history = @(
        @{ role = "user"; content = "머리 아파" }
        @{ role = "assistant"; content = $response1.response }
    )
} | ConvertTo-Json -Depth 3

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body2 -ContentType "application/json; charset=utf-8" -TimeoutSec 15
    Write-Host "Response received:" -ForegroundColor Green
    Write-Host "Stage: $($response2.assessment_stage)"
    Write-Host "Response: $($response2.response)"
    Write-Host ""
    
    # Check Korean final diagnosis elements
    $finalResponse = $response2.response
    $hasHospitalInfo = $finalResponse.Contains("병원") -or $finalResponse.Contains("의사")
    $hasPharmacyInfo = $finalResponse.Contains("약국") -or $finalResponse.Contains("해열제")
    $hasEmergencyInfo = $finalResponse.Contains("119") -or $finalResponse.Contains("응급")
    $hasEndingPhrase = $finalResponse.Contains("상담이 완료")
    
    Write-Host "=== Korean Final Diagnosis Analysis ===" -ForegroundColor Cyan
    Write-Host "Hospital info: $(if($hasHospitalInfo){'YES'}else{'NO'})"
    Write-Host "Pharmacy info: $(if($hasPharmacyInfo){'YES'}else{'NO'})"
    Write-Host "Emergency info: $(if($hasEmergencyInfo){'YES'}else{'NO'})"
    Write-Host "Ending phrase: $(if($hasEndingPhrase){'YES'}else{'NO'})"
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Korean Test Complete ===" -ForegroundColor Green