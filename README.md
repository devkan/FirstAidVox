# FirstAidVox - AI-Powered Emergency Medical Triage System

FirstAidVox is an AI-powered emergency medical triage system that integrates voice recognition, image analysis, and location-based services for comprehensive medical assistance.

## 🚀 Key Features

### Multimodal Diagnostic System
- **Voice Interaction**: Natural voice conversations powered by ElevenLabs TTS
- **Image Analysis**: Injury/symptom image analysis using Gemini Vision
- **Fact Checking**: Medical manual-based information verification via Vertex AI Search
- **Location Services**: Nearby hospital search and navigation using Google Maps API

### User Journey
1. **Access & Voice Interaction**: Access web app and describe symptoms via microphone
2. **Multimodal Diagnosis**: Capture injury photos with camera for AI image analysis
3. **Fact Checking**: Verify information against emergency care manuals
4. **Action Guidance**: Display nearby hospital maps and generate English patient reports

## 🏗️ System Architecture

```
Frontend (React + TypeScript)
├── Voice Interface (ElevenLabs)
├── Camera Interface
├── Map Component (Google Maps)
└── Medical Report Card

Backend (FastAPI + Python)
├── Multimodal Handler
├── Gemini AI Client
├── Vertex AI Search
└── Google Maps Service
```

## 🛠️ Technology Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite** (Build tool)
- **Tailwind CSS** (Styling)
- **ElevenLabs React SDK** (Voice processing)
- **Google Maps React** (Map services)

### Backend
- **FastAPI** (Python web framework)
- **Google Cloud Vertex AI** (Gemini models)
- **Vertex AI Search** (Medical information search)
- **Google Maps API** (Location services)
- **Pydantic** (Data validation)

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd firstaidvox

# Set up environment variables
cp .env.example .env
# Edit .env file with your actual API keys
```

### 2. Google Cloud Setup

1. Create project in Google Cloud Console
2. Enable the following APIs:
   - Vertex AI API
   - Maps JavaScript API
   - Places API
3. Create service account and download key
4. Save key file as `backend/service-account-key.json`

### 3. Run with Docker (Recommended)

```bash
# Run entire system
docker-compose up --build

# Run individual services
docker-compose up backend  # Backend only
docker-compose up frontend # Frontend only
```

### 4. Development Environment

#### Backend
```bash
cd backend
pip install -e .
uvicorn app.main:app --reload --port 3001
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📡 API Endpoints

### POST /chat
Multimodal medical consultation request

**Request Format** (FormData):
```
text: string          # Voice text (required)
latitude?: number     # Latitude (optional)
longitude?: number    # Longitude (optional)  
image?: File         # Image file (optional)
```

**Response Format**:
```json
{
  "response": "AI response text",
  "hospital_data": [...],
  "condition": "diagnosis",
  "urgencyLevel": "low|moderate|high",
  "confidence": 0.85
}
```

### GET /health
System status check

### GET /metrics
Performance metrics

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
# With entire system running
npm run test:integration
```

## 🔧 Development Guide

### Environment Variables

Key environment variables:

- `GOOGLE_CLOUD_PROJECT`: Google Cloud project ID
- `GOOGLE_MAPS_API_KEY`: Google Maps API key
- `ELEVENLABS_API_KEY`: ElevenLabs API key
- `SEARCH_ENGINE_ID`: Vertex AI Search engine ID

### Port Configuration

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001 (Docker maps 8000→3001)

### CORS Configuration

Backend allows these origins:
- http://localhost:5173 (Vite dev server)
- http://localhost:3000 (Create React App)
- http://localhost:8080 (Other dev servers)

## 📱 Usage

1. **Access Web App**: http://localhost:5173
2. **Click Microphone**: "How can I help you?" voice prompt
3. **Describe Symptoms**: Voice description of symptoms
4. **Take Photo** (optional): Camera button to capture injury photos
5. **AI Analysis**: Multimodal AI analyzes symptoms and provides first aid guidance
6. **Hospital Guidance**: Nearby hospital map display and directions
7. **Generate Report**: English patient report for medical professionals

## 🚨 Emergency Response

- **Emergency Contacts**: Emergency contact button at bottom of app
- **Offline Mode**: Basic first aid information available without network
- **Multilingual Support**: English patient reports for international users

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is distributed under the MIT License. See `LICENSE` file for details.

## 🏥 Medical Disclaimer

FirstAidVox is designed as an initial triage tool for emergency situations. The advice from this system cannot replace professional medical diagnosis or treatment. In serious emergency situations, please call 911 immediately or visit the nearest emergency room.