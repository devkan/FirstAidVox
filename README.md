# FirstAidVox - AI-Powered Medical Triage Assistant

FirstAidVox is an AI-powered medical triage system that provides real-time symptom assessment through voice and text conversations, image analysis, and location-based hospital recommendations.

## 🌟 Key Features

### Conversational Medical Triage
- **Multi-turn Conversations**: Natural dialogue flow with 3-4 clarifying questions before diagnosis
- **Multilingual Support**: English, Korean (한국어), Japanese (日本語), Spanish (Español)
- **Voice Interaction**: Real-time voice input using ElevenLabs Conversational AI
- **Text-to-Speech**: Natural voice responses with language-appropriate TTS

### AI-Powered Diagnosis
- **Symptom Analysis**: Intelligent symptom assessment using Google Gemini AI
- **Image Analysis**: Injury/symptom photo analysis with Gemini Vision
- **Medical Fact-Checking**: Verification against medical manuals via Vertex AI Search
- **Confidence Scoring**: Assessment confidence levels for transparency

### Location Services
- **Hospital Search**: Nearby hospital and pharmacy recommendations
- **Google Maps Integration**: Interactive map with hospital markers
- **Distance Calculation**: Shows distance to medical facilities
- **Navigation**: One-click directions to selected hospitals

### Emergency Features
- **Emergency Contacts**: Quick access to 911 and Poison Control
- **Urgency Assessment**: Low/Moderate/High/Emergency classification
- **Offline Support**: Basic first aid information available offline

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React 19 + TypeScript + Vite + Tailwind CSS                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Voice Agent │ │ Chat UI     │ │ Google Maps         │   │
│  │ (ElevenLabs)│ │ (Messages)  │ │ (Hospital Markers)  │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  FastAPI + Python 3.9+                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Gemini AI   │ │ Vertex AI   │ │ Google Maps API     │   │
│  │ (Diagnosis) │ │ (Search)    │ │ (Hospitals)         │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Google Cloud Project with enabled APIs
- ElevenLabs API Key (for voice features)

### 1. Clone Repository
```bash
git clone <repository-url>
cd firstaidvox
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
# Required: GOOGLE_CLOUD_PROJECT, GOOGLE_MAPS_API_KEY
# Optional: ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID
```

### 3. Run with Docker (Recommended)
```bash
docker-compose up --build
```

### 4. Or Run Manually

**Backend:**
```bash
cd backend
pip install -e .
uvicorn app.main:app --reload --port 3001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 5. Access Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/docs

## 📁 Project Structure

```
firstaidvox/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API and voice services
│   │   └── types/           # TypeScript definitions
│   └── README.md
├── backend/                  # FastAPI backend application
│   ├── app/
│   │   ├── handlers/        # Request handlers
│   │   ├── models/          # Data models
│   │   └── services/        # Business logic
│   └── README.md
├── docker-compose.yml        # Docker orchestration
└── README.md                 # This file
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key | - |
| `ELEVENLABS_AGENT_ID` | ElevenLabs Agent ID | - |
| `VERTEX_AI_LOCATION` | Vertex AI region | us-central1 |
| `GEMINI_MODEL_NAME` | Gemini model | gemini-1.5-flash-001 |

## 🧪 Testing

```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm test
```

## 📱 Usage Flow

1. **Start Conversation**: Type or speak your symptoms
2. **Answer Questions**: AI asks 3-4 clarifying questions
3. **Take Photo** (optional): Capture injury/symptom images
4. **Receive Diagnosis**: AI provides assessment with confidence score
5. **Find Hospitals**: View nearby medical facilities on map
6. **Get Directions**: Navigate to selected hospital

## 🚨 Emergency Response

- Red emergency button provides quick access to:
  - 911 Emergency Services
  - Poison Control Center (1-800-222-1222)

## ⚠️ Medical Disclaimer

FirstAidVox is designed as an initial triage tool for emergency situations. The advice from this system **cannot replace professional medical diagnosis or treatment**. In serious emergency situations, please call 911 immediately or visit the nearest emergency room.

## 📄 License

MIT License - See LICENSE file for details.
