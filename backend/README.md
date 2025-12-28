# FirstAidVox Backend

Emergency medical triage system backend with AI-powered analysis using Vertex AI and Google Maps integration.

## Project Structure

```
firstaidvox-backend/
├── app/                    # Main application code
│   └── __init__.py
├── tests/                  # Test files
│   └── __init__.py
├── config/                 # Configuration modules
│   ├── __init__.py
│   ├── settings.py         # Environment settings
│   └── logging.py          # Logging configuration
├── .env.template          # Environment variables template
├── pyproject.toml         # Project dependencies and configuration
└── README.md              # This file
```

## Setup

1. Copy the environment template:
   ```bash
   cp .env.template .env
   ```

2. Fill in your actual values in the `.env` file:
   - Google Cloud Project ID
   - Google Maps API Key
   - Service account credentials path
   - Other configuration as needed

3. Install dependencies:
   ```bash
   pip install -e .
   ```

4. Install development dependencies:
   ```bash
   pip install -e ".[test,dev]"
   ```

## Environment Variables

See `.env.template` for all available configuration options.

### Required Variables
- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key

### Optional Variables
- `VERTEX_AI_LOCATION`: Vertex AI region (default: us-central1)
- `GEMINI_MODEL_NAME`: Gemini model to use (default: gemini-1.5-flash-001)
- `LOG_LEVEL`: Logging level (default: INFO)
- `ENVIRONMENT`: Environment name (default: development)

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black .
isort .
```

### Type Checking
```bash
mypy .
```

## Deployment

This application is designed to run on Google Cloud Run. See deployment documentation for details.