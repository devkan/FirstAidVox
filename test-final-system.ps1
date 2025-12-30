# Final test of the completed conversational medical system
Write-Host "=== Final System Test ===" -ForegroundColor Green

# Test the complete flow
Write-Host "`n1. Initial symptoms..." -ForegroundColor Yellow
$body1 = @{
    message = "I have severe headache and high fever"
    conversation_history = @()
} | ConvertTo-Json -Depth 3

$response1 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body1 -ContentType "application/json" -TimeoutSec 15
Write-Host "Stage: $($response1.assessment_stage) - $($response1.response.Substring(0, 100))..."

Write-Host "`n2. Follow-up details..." -ForegroundColor Yellow
$body2 = @{
    message = "Started 2 days ago, also have body aches and chills, temperature is 39C"
    conversation_history = @(
        @{ role = "user"; content = "I have severe headache and high fever" }
        @{ role = "assistant"; content = $response1.response }
    )
} | ConvertTo-Json -Depth 3

$response2 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body2 -ContentType "application/json" -TimeoutSec 15
Write-Host "Stage: $($response2.assessment_stage)"

# Analyze final diagnosis
$final = $response2.response.ToLower()
$hasDiagnosis = $final.Contains("diagnosis")
$hasHospital = $final.Contains("hospital") -or $final.Contains("doctor")
$hasPharmacy = $final.Contains("pharmacy") -or $final.Contains("medication")
$hasEmergency = $final.Contains("911") -or $final.Contains("emergency")
$hasEnding = $final.Contains("consultation completed")

Write-Host "`n=== SYSTEM COMPLETION STATUS ===" -ForegroundColor Cyan
Write-Host "Diagnosis provided: $(if($hasDiagnosis){'YES'}else{'NO'})"
Write-Host "Hospital guidance: $(if($hasHospital){'YES'}else{'NO'})"
Write-Host "Pharmacy info: $(if($hasPharmacy){'YES'}else{'NO'})"
Write-Host "Emergency contacts: $(if($hasEmergency){'YES'}else{'NO'})"
Write-Host "Conversation ending: $(if($hasEnding){'YES'}else{'NO'})"

$allComplete = $hasDiagnosis -and $hasHospital -and $hasPharmacy -and $hasEmergency -and $hasEnding
Write-Host "`nSYSTEM STATUS: $(if($allComplete){'COMPLETE'}else{'INCOMPLETE'})" -ForegroundColor $(if($allComplete){'Green'}else{'Red'})

Write-Host "`n3. Testing post-diagnosis behavior..." -ForegroundColor Yellow
$body3 = @{
    message = "What about my cough?"
    conversation_history = @(
        @{ role = "user"; content = "I have severe headache and high fever" }
        @{ role = "assistant"; content = $response1.response }
        @{ role = "user"; content = "Started 2 days ago, also have body aches and chills, temperature is 39C" }
        @{ role = "assistant"; content = $response2.response }
    )
} | ConvertTo-Json -Depth 3

$response3 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body3 -ContentType "application/json" -TimeoutSec 15
Write-Host "Stage: $($response3.assessment_stage)"
$noMoreQuestions = -not $response3.response.Contains("?")
Write-Host "No more questions asked: $(if($noMoreQuestions){'YES'}else{'NO'})"

Write-Host "`n=== FINAL RESULT ===" -ForegroundColor Green
if ($allComplete -and $noMoreQuestions) {
    Write-Host "✅ CONVERSATIONAL DIAGNOSIS SYSTEM FULLY IMPLEMENTED" -ForegroundColor Green
    Write-Host "- Efficient 2-3 question triage" -ForegroundColor Green
    Write-Host "- Complete final diagnosis with hospital/pharmacy info" -ForegroundColor Green
    Write-Host "- Proper conversation ending" -ForegroundColor Green
    Write-Host "- No re-questioning after diagnosis" -ForegroundColor Green
} else {
    Write-Host "❌ SYSTEM INCOMPLETE" -ForegroundColor Red
}