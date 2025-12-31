# FirstAidVox Frontend

React-based frontend for AI-powered medical triage with voice interaction and real-time chat.

## 🌟 Features

### Chat Interface
- **Conversational UI**: Natural chat-style medical consultation
- **Message Bubbles**: User and AI messages with timestamps
- **Typing Indicators**: Real-time feedback during AI processing
- **Conversation Progress**: Visual progress tracker for assessment stages

### Voice Interaction
- **ElevenLabs Integration**: High-quality voice recognition
- **Text-to-Speech**: Natural voice responses
- **Multilingual TTS**: English, Korean, Japanese, Spanish
- **Browser TTS Fallback**: Works without ElevenLabs API

### Medical Features
- **Symptom Assessment**: AI-powered diagnosis with confidence scores
- **Hospital Recommendations**: Nearby medical facilities with maps
- **Emergency Contacts**: Quick access to 911 and Poison Control
- **Image Upload**: Photo analysis for visible symptoms

### Map Integration
- **Google Maps**: Interactive hospital location display
- **Hospital Markers**: Clickable markers with facility info
- **Directions**: One-click navigation to hospitals
- **Distance Display**: Shows proximity to each facility

## 🏗️ Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatContainer.tsx    # Main chat component
│   │   │   ├── ChatInput.tsx        # Message input with voice
│   │   │   ├── MessageBubble.tsx    # Chat message display
│   │   │   ├── TypingIndicator.tsx  # Loading animation
│   │   │   ├── EmergencyButton.tsx  # Emergency contacts
│   │   │   └── ConversationProgress.tsx  # Progress tracker
│   │   ├── MapComponent.tsx         # Google Maps integration
│   │   ├── CameraInterface.tsx      # Photo capture
│   │   └── VoiceInterface.tsx       # Voice controls
│   ├── hooks/
│   │   ├── useAppState.ts           # Global state management
│   │   └── useVoiceAgent.ts         # Voice agent hook
│   ├── services/
│   │   ├── backendService.ts        # API communication
│   │   ├── voiceAgent.ts            # ElevenLabs integration
│   │   ├── conversationalService.ts # Conversation management
│   │   ├── errorHandler.ts          # Error handling
│   │   └── offlineFallback.ts       # Offline support
│   ├── types/
│   │   └── index.ts                 # TypeScript definitions
│   └── App.tsx                      # Root component
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create `.env` file:

```env
# Required
VITE_BACKEND_URL=http://localhost:3001
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key

# Optional (for voice features)
VITE_ELEVENLABS_API_KEY=your-elevenlabs-key
VITE_ELEVENLABS_AGENT_ID=your-agent-id
```

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run test     # Run tests
npm run lint     # Run ESLint
```

## 🎨 UI Components

### ChatContainer
Main chat interface with:
- Message history display
- Voice input toggle
- Image attachment
- Auto-scroll to latest message

### ChatInput
Input component with:
- Text input field
- Voice recording button
- Image upload button
- Send button

### MessageBubble
Message display with:
- User/AI differentiation
- Timestamp
- Hospital data cards
- Markdown rendering

### EmergencyButton
Floating emergency button with:
- 911 quick dial
- Poison Control contact
- Expandable contact list

### MapComponent
Google Maps integration with:
- Hospital markers
- Info windows
- Directions links
- Distance display

## 🔊 Voice Features

### ElevenLabs Integration
- Real-time speech-to-text
- Natural voice responses
- Auto language detection
- Volume control

### Browser TTS Fallback
- Works without API key
- Supports multiple languages
- Adjustable speech rate
- Voice selection

### Language Support
| Language | Code | TTS | STT |
|----------|------|-----|-----|
| English | en-US | ✅ | ✅ |
| Korean | ko-KR | ✅ | ✅ |
| Japanese | ja-JP | ✅ | ✅ |
| Spanish | es-ES | ✅ | ✅ |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/test/chat-container.test.tsx
```

### Test Categories
- Unit tests for components
- Integration tests for services
- Property-based tests with fast-check
- Accessibility tests

## 📱 Responsive Design

- **Mobile**: Full-screen chat, bottom input
- **Tablet**: Optimized layout, larger touch targets
- **Desktop**: Centered container, keyboard shortcuts

### Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## 🎯 State Management

### useAppState Hook
Global state for:
- Medical assessment data
- Processing status
- Conversation history
- UI notifications

### useVoiceAgent Hook
Voice state for:
- Connection status
- Recording state
- Audio levels
- Error handling

## 🔧 Configuration

### Vite Config
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

### Tailwind Config
Custom colors:
- `medical-*`: Primary medical theme
- `safe-*`: Low urgency (green)
- `warning-*`: Moderate urgency (yellow)
- `emergency-*`: High urgency (red)

## 🐳 Docker

```bash
# Build
docker build -t firstaidvox-frontend .

# Run
docker run -p 5173:80 firstaidvox-frontend
```

## 📄 License

MIT License
