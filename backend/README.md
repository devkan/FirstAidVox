# FirstAidVox Backend

FastAPI-based backend service for AI-powered medical triage with Google Cloud integration.

## 🌟 Features

### AI Services
- **Conversational AI**: Multi-turn medical conversations using Gemini AI
- **Image Analysis**: Symptom/injury photo analysis with Gemini Vision
- **Medical Search**: Fact-checking via Vertex AI Search
- **Language Detection**: Automatic response language matching

### Location Services
- **Hospital Search**: Find nearby hospitals and pharmacies
- **Google Maps Integration**: Places API for medical facilities
- **Distance Calculation**: Proximity-based recommendations

### API Endpoints
- `POST /chat/conversational` - Conversational medical triage
- `POST /chat` - Single-turn medical consultation
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

## 🏗️ Architecture

```
backend/
├── app/
│   ├── main.py                    # FastAPI application entry
│   ├── handlers/
│   │   └── multimodal.py          # Request handlers
│   ├── models/
│   │   ├── chat.py                # Chat request/response models
│   │   ├── hospital.py            # Hospital data models
│   │   ├── location.py            # Location models
│   │   └── internal.py            # Internal data models
│   └── services/
│       ├── ai_service.py          # Single-turn AI service
│       ├── ai_service_conversational.py  # Multi-turn AI service
│       ├── location_service.py    # Google Maps integration
│       ├── search_service.py      # Vertex AI Search
│       └── service_manager.py     # Service lifecycle management
├── config/
│   ├── settings.py                # Environment configuration
│   └── logging.py                 # Logging setup
├── tests/                         # Test files
├── pyproject.toml                 # Dependencies
└── Dockerfile                     # Container configuration
```

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Google Cloud Project
- Service Account Key

### Installation

```bash
# Install dependencies
pip install -e .

# Install dev dependencies
pip install -e ".[test,dev]"
```

### Configuration

```bash
# Copy environment template
cp .env.template .env

# Edit .env with your values
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VERTEX_AI_LOCATION` | us-central1 | Vertex AI region |
| `GEMINI_MODEL_NAME` | gemini-1.5-flash-001 | Gemini model |
| `LOG_LEVEL` | INFO | Logging level |
| `ENVIRONMENT` | development | Environment name |
| `MAX_CONVERSATION_TURNS` | 10 | Max conversation turns |

### Run Server

```bash
# Development
uvicorn app.main:app --reload --port 3001

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 📡 API Reference

### POST /chat/conversational

Multi-turn conversational medical triage.

**Request:**
```json
{
  "text": "I have a headache",
  "conversation_history": [],
  "location": {
    "latitude": 37.5665,
    "longitude": 126.9780
  }
}
```

**Response:**
```json
{
  "response": "I understand you have a headache...",
  "brief_text": "Need more information about headache",
  "detailed_text": "To provide the best assessment...",
  "condition": "Headache - Initial Assessment",
  "urgency_level": "moderate",
  "confidence": 0.8,
  "assessment_stage": "clarification",
  "hospital_data": []
}
```

### POST /chat

Single-turn medical consultation with optional image.

**Request (FormData):**
- `text`: Symptom description (required)
- `latitude`: User latitude (optional)
- `longitude`: User longitude (optional)
- `image`: Image file (optional)

**Response:**
```json
{
  "response": "Based on your symptoms...",
  "hospital_data": [...],
  "condition": "Assessment",
  "urgencyLevel": "moderate",
  "confidence": 0.85
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_services_property.py

# Run property-based tests
pytest -m property
```

## 🔧 Development

### Code Formatting
```bash
black .
isort .
```

### Type Checking
```bash
mypy .
```

### Linting
```bash
flake8 .
```

## 🐳 Docker

### Build
```bash
docker build -t firstaidvox-backend .
```

### Run
```bash
docker run -p 3001:8000 \
  -e GOOGLE_CLOUD_PROJECT=your-project \
  -e GOOGLE_MAPS_API_KEY=your-key \
  -v /path/to/service-account.json:/app/service-account-key.json \
  firstaidvox-backend
```

## 📊 Monitoring

### Metrics Endpoint
`GET /metrics` returns:
- Request counts
- Response times
- Error rates
- AI service latency

### Logging
Structured JSON logging with:
- Request ID tracking
- Performance metrics
- Error details

## 🔒 Security

- CORS configured for allowed origins
- Input validation with Pydantic
- Rate limiting (configurable)
- No sensitive data in logs

## 📄 License

MIT License
