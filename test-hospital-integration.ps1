# Test hospital integration with location
Write-Host "=== Testing Hospital Integration ===" -ForegroundColor Green

# Test with location data
Write-Host "`n1. Testing with location data..." -ForegroundColor Yellow
$body1 = @{
    message = "I have severe headache and high fever"
    conversation_history = @()
    user_location = @{
        latitude = 37.5665
        longitude = 126.9780
    }
} | ConvertTo-Json -Depth 3

$response1 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body1 -ContentType "application/json" -TimeoutSec 15
Write-Host "Stage: $($response1.assessment_stage)"

Write-Host "`n2. Follow-up for final diagnosis..." -ForegroundColor Yellow
$body2 = @{
    message = "Started 2 days ago, also have body aches and chills, temperature is 39C"
    conversation_history = @(
        @{ role = "user"; content = "I have severe headache and high fever" }
        @{ role = "assistant"; content = $response1.response }
    )
    user_location = @{
        latitude = 37.5665
        longitude = 126.9780
    }
} | ConvertTo-Json -Depth 3

$response2 = Invoke-RestMethod -Uri "http://localhost:3001/chat/conversational" -Method POST -Body $body2 -ContentType "application/json" -TimeoutSec 15

Write-Host "=== RESULTS ===" -ForegroundColor Cyan
Write-Host "Stage: $($response2.assessment_stage)"
Write-Host "Has hospital data: $(if($response2.hospital_data -and $response2.hospital_data.Count -gt 0){'YES - ' + $response2.hospital_data.Count + ' hospitals'}else{'NO'})"

if ($response2.hospital_data -and $response2.hospital_data.Count -gt 0) {
    Write-Host "`nHospital Information:" -ForegroundColor Green
    for ($i = 0; $i -lt [Math]::Min(3, $response2.hospital_data.Count); $i++) {
        $hospital = $response2.hospital_data[$i]
        Write-Host "  $($i+1). $($hospital.name)"
        if ($hospital.address) { Write-Host "     Address: $($hospital.address)" }
        if ($hospital.phone) { Write-Host "     Phone: $($hospital.phone)" }
        if ($hospital.distance) { Write-Host "     Distance: $($hospital.distance)km" }
    }
}

# Check response format
$hasStructuredFormat = $response2.response.Contains("BRIEF:") -and $response2.response.Contains("DETAILED:")
Write-Host "`nStructured format (BRIEF/DETAILED): $(if($hasStructuredFormat){'YES'}else{'NO'})"

Write-Host "`n=== Test Complete ===" -ForegroundColor Green