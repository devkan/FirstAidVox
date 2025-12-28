# FirstAidVox Backend Deployment Script (PowerShell)
# Deploys the application to Google Cloud Run with proper configuration

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "us-central1",
    [string]$ServiceName = "firstaidvox-backend"
)

# Configuration
$ImageName = "gcr.io/$ProjectId/$ServiceName"

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check if gcloud is installed
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Error "gcloud CLI is not installed. Please install it first."
        exit 1
    }
    
    # Check if docker is installed
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed. Please install it first."
        exit 1
    }
    
    # Check if PROJECT_ID is set
    if (-not $ProjectId) {
        Write-Error "GOOGLE_CLOUD_PROJECT environment variable is not set."
        Write-Error "Please set it to your Google Cloud project ID or pass -ProjectId parameter."
        exit 1
    }
    
    # Check if user is authenticated
    $authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if (-not $authCheck) {
        Write-Error "Not authenticated with gcloud. Please run 'gcloud auth login'."
        exit 1
    }
    
    Write-Info "Prerequisites check passed."
}

# Enable required APIs
function Enable-APIs {
    Write-Info "Enabling required Google Cloud APIs..."
    
    gcloud services enable `
        cloudbuild.googleapis.com `
        run.googleapis.com `
        containerregistry.googleapis.com `
        aiplatform.googleapis.com `
        places-backend.googleapis.com `
        --project="$ProjectId"
    
    Write-Info "APIs enabled successfully."
}

# Create service account and set permissions
function Setup-ServiceAccount {
    Write-Info "Setting up service account..."
    
    $SAName = "firstaidvox-backend-sa"
    $SAEmail = "$SAName@$ProjectId.iam.gserviceaccount.com"
    
    # Create service account if it doesn't exist
    $saExists = gcloud iam service-accounts describe $SAEmail --project="$ProjectId" 2>$null
    if (-not $saExists) {
        gcloud iam service-accounts create $SAName `
            --display-name="FirstAidVox Backend Service Account" `
            --description="Service account for FirstAidVox backend application" `
            --project="$ProjectId"
    }
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$SAEmail" `
        --role="roles/aiplatform.user"
    
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$SAEmail" `
        --role="roles/secretmanager.secretAccessor"
    
    Write-Info "Service account setup completed."
}

# Create secrets for sensitive configuration
function Setup-Secrets {
    Write-Info "Setting up secrets..."
    
    # Check if Google Maps API key secret exists
    $secretExists = gcloud secrets describe google-maps-api-key --project="$ProjectId" 2>$null
    if (-not $secretExists) {
        Write-Warn "Google Maps API key secret not found."
        Write-Warn "Please create it manually:"
        Write-Warn "gcloud secrets create google-maps-api-key --project=$ProjectId"
        Write-Warn "echo 'YOUR_API_KEY' | gcloud secrets versions add google-maps-api-key --data-file=- --project=$ProjectId"
    } else {
        Write-Info "Google Maps API key secret already exists."
    }
}

# Build and push Docker image
function Build-AndPush {
    Write-Info "Building and pushing Docker image..."
    
    # Build the image
    docker build -t "$ImageName`:latest" .
    
    # Configure Docker to use gcloud as a credential helper
    gcloud auth configure-docker --quiet
    
    # Push the image
    docker push "$ImageName`:latest"
    
    Write-Info "Docker image built and pushed successfully."
}

# Deploy to Cloud Run
function Deploy-ToCloudRun {
    Write-Info "Deploying to Cloud Run..."
    
    # Deploy the service
    gcloud run deploy $ServiceName `
        --image="$ImageName`:latest" `
        --region="$Region" `
        --platform=managed `
        --allow-unauthenticated `
        --memory=2Gi `
        --cpu=2 `
        --concurrency=100 `
        --max-instances=10 `
        --min-instances=1 `
        --timeout=300 `
        --service-account="firstaidvox-backend-sa@$ProjectId.iam.gserviceaccount.com" `
        --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO,GOOGLE_CLOUD_PROJECT=$ProjectId,VERTEX_AI_LOCATION=$Region" `
        --port=8000 `
        --project="$ProjectId"
    
    # Get the service URL
    $ServiceURL = gcloud run services describe $ServiceName `
        --region="$Region" `
        --project="$ProjectId" `
        --format="value(status.url)"
    
    Write-Info "Deployment completed successfully!"
    Write-Info "Service URL: $ServiceURL"
    Write-Info "Health check: $ServiceURL/health"
}

# Verify deployment
function Test-Deployment {
    Write-Info "Verifying deployment..."
    
    $ServiceURL = gcloud run services describe $ServiceName `
        --region="$Region" `
        --project="$ProjectId" `
        --format="value(status.url)"
    
    # Wait a moment for the service to be ready
    Start-Sleep -Seconds 10
    
    # Check health endpoint
    try {
        $response = Invoke-WebRequest -Uri "$ServiceURL/health" -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Info "Health check passed! Service is running correctly."
        } else {
            throw "Health check returned status code: $($response.StatusCode)"
        }
    } catch {
        Write-Error "Health check failed. Please check the service logs."
        Write-Error "View logs with: gcloud logs tail --service=$ServiceName --project=$ProjectId"
        exit 1
    }
}

# Main deployment function
function Main {
    Write-Info "Starting FirstAidVox Backend deployment..."
    Write-Info "Project: $ProjectId"
    Write-Info "Region: $Region"
    Write-Info "Service: $ServiceName"
    
    Test-Prerequisites
    Enable-APIs
    Setup-ServiceAccount
    Setup-Secrets
    Build-AndPush
    Deploy-ToCloudRun
    Test-Deployment
    
    Write-Info "Deployment completed successfully!"
    Write-Info "Your FirstAidVox Backend is now running on Google Cloud Run."
}

# Run main function
Main