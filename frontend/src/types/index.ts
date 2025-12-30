// Core application types

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface VoiceState {
  isActive: boolean;
  isListening: boolean;
  isProcessing: boolean;
  currentTranscription: string;
  audioLevel: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  queueSize: number;
  isProcessingQueue: boolean;
  currentSessionId: string | null;
}

export interface CameraState {
  isActive: boolean;
  hasPermission: boolean;
  previewImage: string | null;
  isUploading: boolean;
  uploadProgress: number;
  lastUploadId: string | null;
}

export interface EmergencyService {
  type: 'emergency_room' | 'urgent_care' | 'trauma_center';
  waitTime: number;
  availability: 'available' | 'busy' | 'full';
}

export interface HospitalLocation {
  id: string;
  name: string;
  coordinates: Coordinates;
  address: string;
  phone: string;
  distance: number;
  emergencyServices: EmergencyService[];
  rating: number;
  isOpen24Hours: boolean;
}

export interface MapState {
  isVisible: boolean;
  hospitals: HospitalLocation[];
  userLocation: Coordinates | null;
  selectedHospital: string | null;
}

export interface MedicalResponse {
  condition: string;
  urgencyLevel: 'low' | 'moderate' | 'high';
  advice: string;
  confidence: number;
  hospitalData?: HospitalLocation[];
  requiresEmergencyServices: boolean;
}

export interface ConversationEntry {
  id: string;
  timestamp: Date;
  type: 'user_voice' | 'user_image' | 'system_response';
  content: string;
  metadata?: {
    audioUrl?: string;
    imageUrl?: string;
    confidence?: number;
  };
}

export interface MedicalState {
  currentAssessment: MedicalResponse | null;
  conversationHistory: ConversationEntry[];
  isProcessing: boolean;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
}

export interface UIState {
  activePanel: 'voice' | 'camera' | 'map' | 'report';
  showBottomSheet: boolean;
  notifications: Notification[];
  theme: 'light' | 'dark';
}

// Main application state interface - EXPLICITLY EXPORTED
export interface AppState {
  voice: VoiceState;
  camera: CameraState;
  map: MapState;
  medical: MedicalState;
  ui: UIState;
}

// New unified agent response type for single chat endpoint
export interface AgentResponse {
  response: string; // AI agent response text for TTS
  hospital_data?: HospitalLocation[]; // Hospital data if location services needed
  condition?: string; // Medical condition assessment
  urgencyLevel?: 'low' | 'moderate' | 'high'; // Urgency classification
  confidence?: number; // Assessment confidence level
}

export interface UploadResponse {
  id: string;
  url: string;
  status: 'success' | 'error';
  message?: string;
}