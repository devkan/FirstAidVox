# FirstAidVox Backend Deployment Guide

This directory contains deployment configurations and scripts for deploying the FirstAidVox Backend to Google Cloud Run.

## Prerequisites

1. **Google Cloud SDK**: Install and configure the gcloud CLI
2. **Docker**: Install Docker for building container images
3. **Google Cloud Project**: Create a project with billing enabled
4. **APIs**: The deployment script will enable required APIs automatically

## Required APIs

The following Google Cloud APIs will be enabled during deployment:

- Cloud Build API (`cloudbuild.googleapis.com`)
- Cloud Run API (`run.googleapis.com`)
- Container Registry API (`containerregistry.googleapis.com`)
- Vertex AI API (`aiplatform.googleapis.com`)
- Places API (`places-backend.googleapis.com`)

## Environment Setup

1. **Set your Google Cloud project**:
   ```bash
   export GOOGLE_CLOUD_PROJECT=your-project-id
   ```

2. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   gcloud config set project $GOOGLE_CLOUD_PROJECT
   ```

3. **Create Google Maps API key**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services > Credentials
   - Create an API key and restrict it to the Places API
   - Store the key securely

## Deployment Methods

### Method 1: Automated Deployment Script

#### Linux/macOS:
```bash
# Make the script executable
chmod +x deploy/deploy.sh

# Run the deployment
./deploy/deploy.sh
```

#### Windows (PowerShell):
```powershell
# Run the PowerShell deployment script
.\deploy\deploy.ps1 -ProjectId "your-project-id"
```

### Method 2: Google Cloud Build

1. **Trigger Cloud Build**:
   ```bash
   gcloud builds submit --config=deploy/cloudbuild.yaml \
     --substitutions=_GOOGLE_MAPS_API_KEY="your-api-key"
   ```

### Method 3: Manual Deployment

1. **Build and push Docker image**:
   ```bash
   docker build -t gcr.io/$GOOGLE_CLOUD_PROJECT/firstaidvox-backend .
   docker push gcr.io/$GOOGLE_CLOUD_PROJECT/firstaidvox-backend
   ```

2. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy firstaidvox-backend \
     --image gcr.io/$GOOGLE_CLOUD_PROJECT/firstaidvox-backend \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 2 \
     --set-env-vars ENVIRONMENT=production,GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT
   ```

## Configuration Files

### `cloudbuild.yaml`
Google Cloud Build configuration for automated CI/CD deployment.

### `cloud-run-service.yaml`
Kubernetes-style service definition for Cloud Run with comprehensive configuration.

### `deploy.sh` / `deploy.ps1`
Automated deployment scripts that handle the complete deployment process.

### `environment-template.env`
Template for environment variables. Copy to `.env` for local development.

## Security Configuration

### Service Account
The deployment creates a service account with minimal required permissions:
- `roles/aiplatform.user` - For Vertex AI access
- `roles/secretmanager.secretAccessor` - For accessing API keys

### Secrets Management
Sensitive configuration is stored in Google Secret Manager:
- Google Maps API key is stored as `google-maps-api-key` secret

### Network Security
- HTTPS-only communication
- CORS configured for specific origins
- No public access to internal endpoints

## Monitoring and Health Checks

### Health Endpoints
- `/health` - Basic health check with service status
- `/metrics` - Application metrics for monitoring

### Logging
- Structured JSON logging in production
- Request/response logging with sanitized data
- External service call logging
- Error tracking with stack traces

### Cloud Run Configuration
- **Memory**: 2GB
- **CPU**: 2 vCPUs
- **Concurrency**: 100 requests per instance
- **Scaling**: 1-10 instances
- **Timeout**: 300 seconds

## Verification

After deployment, verify the service is working:

1. **Check service status**:
   ```bash
   gcloud run services describe firstaidvox-backend --region=us-central1
   ```

2. **Test health endpoint**:
   ```bash
   curl https://your-service-url/health
   ```

3. **View logs**:
   ```bash
   gcloud logs tail --service=firstaidvox-backend
   ```

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Ensure you're authenticated: `gcloud auth login`
   - Check project permissions: `gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT`

2. **API Key Issues**:
   - Verify the Google Maps API key is correct
   - Check API restrictions and quotas
   - Ensure Places API is enabled

3. **Memory/CPU Issues**:
   - Monitor resource usage in Cloud Run console
   - Adjust memory/CPU limits in deployment configuration

4. **Service Startup Issues**:
   - Check startup logs: `gcloud logs read --service=firstaidvox-backend --limit=50`
   - Verify all environment variables are set correctly

### Log Analysis

View detailed logs for debugging:
```bash
# Real-time logs
gcloud logs tail --service=firstaidvox-backend --project=$GOOGLE_CLOUD_PROJECT

# Historical logs
gcloud logs read --service=firstaidvox-backend --limit=100 --project=$GOOGLE_CLOUD_PROJECT

# Filter by severity
gcloud logs read --service=firstaidvox-backend --filter="severity>=ERROR" --project=$GOOGLE_CLOUD_PROJECT
```

## Cost Optimization

### Resource Management
- Minimum instances: 1 (for availability)
- Maximum instances: 10 (adjust based on traffic)
- CPU allocation: 2 vCPUs (can be reduced for lower traffic)
- Memory: 2GB (minimum for AI processing)

### Monitoring Costs
- Use Cloud Monitoring to track resource usage
- Set up billing alerts for cost control
- Monitor request patterns to optimize scaling

## Security Best Practices

1. **API Keys**: Store in Secret Manager, never in code
2. **Service Account**: Use minimal required permissions
3. **CORS**: Configure for specific domains only
4. **HTTPS**: Enforce HTTPS-only communication
5. **Input Validation**: Validate all inputs server-side
6. **Logging**: Sanitize sensitive data in logs

## Support

For deployment issues:
1. Check the troubleshooting section above
2. Review Cloud Run logs for error details
3. Verify all prerequisites are met
4. Ensure API quotas are sufficient