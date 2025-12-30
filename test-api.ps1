# Test the FirstAidVox API
$uri = "http://localhost:3001/chat"
$body = @{
    text = "I have a headache and feel dizzy"
}

try {
    $response = Invoke-RestMethod -Uri $uri -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
    Write-Host "✅ API Response received:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ API Error:"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}