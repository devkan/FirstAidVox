#!/bin/bash

# FirstAidVox Backend Deployment Script
# Deploys the application to Google Cloud Run with proper configuration

set -e  # Exit on any error

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="firstaidvox-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if PROJECT_ID is set
    if [ -z "$PROJECT_ID" ]; then
        log_error "GOOGLE_CLOUD_PROJECT environment variable is not set."
        log_error "Please set it to your Google Cloud project ID."
        exit 1
    fi
    
    # Check if user is authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "Not authenticated with gcloud. Please run 'gcloud auth login'."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Enable required APIs
enable_apis() {
    log_info "Enabling required Google Cloud APIs..."
    
    gcloud services enable \
        cloudbuild.googleapis.com \
        run.googleapis.com \
        containerregistry.googleapis.com \
        aiplatform.googleapis.com \
        places-backend.googleapis.com \
        --project="$PROJECT_ID"
    
    log_info "APIs enabled successfully."
}

# Create service account and set permissions
setup_service_account() {
    log_info "Setting up service account..."
    
    SA_NAME="firstaidvox-backend-sa"
    SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    
    # Create service account if it doesn't exist
    if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &> /dev/null; then
        gcloud iam service-accounts create "$SA_NAME" \
            --display-name="FirstAidVox Backend Service Account" \
            --description="Service account for FirstAidVox backend application" \
            --project="$PROJECT_ID"
    fi
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/aiplatform.user"
    
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/secretmanager.secretAccessor"
    
    log_info "Service account setup completed."
}

# Create secrets for sensitive configuration
setup_secrets() {
    log_info "Setting up secrets..."
    
    # Check if Google Maps API key secret exists
    if ! gcloud secrets describe google-maps-api-key --project="$PROJECT_ID" &> /dev/null; then
        log_warn "Google Maps API key secret not found."
        log_warn "Please create it manually:"
        log_warn "gcloud secrets create google-maps-api-key --project=$PROJECT_ID"
        log_warn "echo 'YOUR_API_KEY' | gcloud secrets versions add google-maps-api-key --data-file=- --project=$PROJECT_ID"
    else
        log_info "Google Maps API key secret already exists."
    fi
}

# Build and push Docker image
build_and_push() {
    log_info "Building and pushing Docker image..."
    
    # Build the image
    docker build -t "$IMAGE_NAME:latest" .
    
    # Configure Docker to use gcloud as a credential helper
    gcloud auth configure-docker --quiet
    
    # Push the image
    docker push "$IMAGE_NAME:latest"
    
    log_info "Docker image built and pushed successfully."
}

# Deploy to Cloud Run
deploy_to_cloud_run() {
    log_info "Deploying to Cloud Run..."
    
    # Deploy the service
    gcloud run deploy "$SERVICE_NAME" \
        --image="$IMAGE_NAME:latest" \
        --region="$REGION" \
        --platform=managed \
        --allow-unauthenticated \
        --memory=2Gi \
        --cpu=2 \
        --concurrency=100 \
        --max-instances=10 \
        --min-instances=1 \
        --timeout=300 \
        --service-account="firstaidvox-backend-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
        --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,VERTEX_AI_LOCATION=$REGION" \
        --port=8000 \
        --project="$PROJECT_ID"
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)")
    
    log_info "Deployment completed successfully!"
    log_info "Service URL: $SERVICE_URL"
    log_info "Health check: $SERVICE_URL/health"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)")
    
    # Wait a moment for the service to be ready
    sleep 10
    
    # Check health endpoint
    if curl -f -s "$SERVICE_URL/health" > /dev/null; then
        log_info "Health check passed! Service is running correctly."
    else
        log_error "Health check failed. Please check the service logs."
        log_error "View logs with: gcloud logs tail --service=$SERVICE_NAME --project=$PROJECT_ID"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting FirstAidVox Backend deployment..."
    log_info "Project: $PROJECT_ID"
    log_info "Region: $REGION"
    log_info "Service: $SERVICE_NAME"
    
    check_prerequisites
    enable_apis
    setup_service_account
    setup_secrets
    build_and_push
    deploy_to_cloud_run
    verify_deployment
    
    log_info "Deployment completed successfully!"
    log_info "Your FirstAidVox Backend is now running on Google Cloud Run."
}

# Run main function
main "$@"