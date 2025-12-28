import React, { useReducer, createContext, useContext, ReactNode } from 'react';
import {
  AppState,
  VoiceState,
  CameraState,
  MapState,
  MedicalState,
  UIState,
  HospitalLocation,
  MedicalResponse,
  ConversationEntry,
  Coordinates,
  Notification
} from '../types';

// Action types for each state domain
export type VoiceAction =
  | { type: 'VOICE_ACTIVATE' }
  | { type: 'VOICE_DEACTIVATE' }
  | { type: 'VOICE_START_LISTENING' }
  | { type: 'VOICE_STOP_LISTENING' }
  | { type: 'VOICE_START_PROCESSING' }
  | { type: 'VOICE_STOP_PROCESSING' }
  | { type: 'VOICE_UPDATE_TRANSCRIPTION'; payload: string }
  | { type: 'VOICE_UPDATE_AUDIO_LEVEL'; payload: number }
  | { type: 'VOICE_UPDATE_CONNECTION_STATUS'; payload: 'connected' | 'connecting' | 'disconnected' }
  | { type: 'VOICE_UPDATE_QUEUE_SIZE'; payload: number }
  | { type: 'VOICE_SET_PROCESSING_QUEUE'; payload: boolean }
  | { type: 'VOICE_SET_SESSION'; payload: string | null };

export type CameraAction =
  | { type: 'CAMERA_ACTIVATE' }
  | { type: 'CAMERA_DEACTIVATE' }
  | { type: 'CAMERA_SET_PERMISSION'; payload: boolean }
  | { type: 'CAMERA_SET_PREVIEW'; payload: string | null }
  | { type: 'CAMERA_START_UPLOAD' }
  | { type: 'CAMERA_UPDATE_UPLOAD_PROGRESS'; payload: number }
  | { type: 'CAMERA_COMPLETE_UPLOAD'; payload: string }
  | { type: 'CAMERA_RESET_UPLOAD' };

export type MapAction =
  | { type: 'MAP_SHOW' }
  | { type: 'MAP_HIDE' }
  | { type: 'MAP_SET_HOSPITALS'; payload: HospitalLocation[] }
  | { type: 'MAP_SET_USER_LOCATION'; payload: Coordinates | null }
  | { type: 'MAP_SELECT_HOSPITAL'; payload: string | null };

export type MedicalAction =
  | { type: 'MEDICAL_START_PROCESSING' }
  | { type: 'MEDICAL_STOP_PROCESSING' }
  | { type: 'MEDICAL_SET_ASSESSMENT'; payload: MedicalResponse }
  | { type: 'MEDICAL_ADD_CONVERSATION_ENTRY'; payload: ConversationEntry }
  | { type: 'MEDICAL_CLEAR_ASSESSMENT' };

export type UIAction =
  | { type: 'UI_SET_ACTIVE_PANEL'; payload: 'voice' | 'camera' | 'map' | 'report' }
  | { type: 'UI_SHOW_BOTTOM_SHEET' }
  | { type: 'UI_HIDE_BOTTOM_SHEET' }
  | { type: 'UI_ADD_NOTIFICATION'; payload: Notification }
  | { type: 'UI_REMOVE_NOTIFICATION'; payload: string }
  | { type: 'UI_SET_THEME'; payload: 'light' | 'dark' };

export type AppAction =
  | { type: 'VOICE'; payload: VoiceAction }
  | { type: 'CAMERA'; payload: CameraAction }
  | { type: 'MAP'; payload: MapAction }
  | { type: 'MEDICAL'; payload: MedicalAction }
  | { type: 'UI'; payload: UIAction };

// Initial states
const initialVoiceState: VoiceState = {
  isActive: false,
  isListening: false,
  isProcessing: false,
  currentTranscription: '',
  audioLevel: 0,
  connectionStatus: 'disconnected',
  queueSize: 0,
  isProcessingQueue: false,
  currentSessionId: null
};

const initialCameraState: CameraState = {
  isActive: false,
  hasPermission: false,
  previewImage: null,
  isUploading: false,
  uploadProgress: 0,
  lastUploadId: null
};

const initialMapState: MapState = {
  isVisible: false,
  hospitals: [],
  userLocation: null,
  selectedHospital: null
};

const initialMedicalState: MedicalState = {
  currentAssessment: null,
  conversationHistory: [],
  isProcessing: false
};

const initialUIState: UIState = {
  activePanel: 'voice',
  showBottomSheet: false,
  notifications: [],
  theme: 'light'
};

export const initialAppState: AppState = {
  voice: initialVoiceState,
  camera: initialCameraState,
  map: initialMapState,
  medical: initialMedicalState,
  ui: initialUIState
};
// State reducers
function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'VOICE_ACTIVATE':
      return { ...state, isActive: true, connectionStatus: 'connecting' };
    case 'VOICE_DEACTIVATE':
      return { 
        ...state, 
        isActive: false, 
        isListening: false, 
        isProcessing: false, 
        connectionStatus: 'disconnected',
        queueSize: 0,
        isProcessingQueue: false,
        currentSessionId: null
      };
    case 'VOICE_START_LISTENING':
      return { ...state, isListening: true, isProcessing: false };
    case 'VOICE_STOP_LISTENING':
      return { ...state, isListening: false };
    case 'VOICE_START_PROCESSING':
      return { ...state, isProcessing: true, isListening: false };
    case 'VOICE_STOP_PROCESSING':
      return { ...state, isProcessing: false };
    case 'VOICE_UPDATE_TRANSCRIPTION':
      return { ...state, currentTranscription: action.payload };
    case 'VOICE_UPDATE_AUDIO_LEVEL':
      return { ...state, audioLevel: action.payload };
    case 'VOICE_UPDATE_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'VOICE_UPDATE_QUEUE_SIZE':
      return { ...state, queueSize: action.payload };
    case 'VOICE_SET_PROCESSING_QUEUE':
      return { ...state, isProcessingQueue: action.payload };
    case 'VOICE_SET_SESSION':
      return { ...state, currentSessionId: action.payload };
    default:
      return state;
  }
}

function cameraReducer(state: CameraState, action: CameraAction): CameraState {
  switch (action.type) {
    case 'CAMERA_ACTIVATE':
      return { ...state, isActive: true };
    case 'CAMERA_DEACTIVATE':
      return { ...state, isActive: false, previewImage: null };
    case 'CAMERA_SET_PERMISSION':
      return { ...state, hasPermission: action.payload };
    case 'CAMERA_SET_PREVIEW':
      return { ...state, previewImage: action.payload };
    case 'CAMERA_START_UPLOAD':
      return { ...state, isUploading: true, uploadProgress: 0 };
    case 'CAMERA_UPDATE_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.payload };
    case 'CAMERA_COMPLETE_UPLOAD':
      return { ...state, isUploading: false, uploadProgress: 100, lastUploadId: action.payload, previewImage: null };
    case 'CAMERA_RESET_UPLOAD':
      return { ...state, isUploading: false, uploadProgress: 0, previewImage: null };
    default:
      return state;
  }
}

function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'MAP_SHOW':
      return { ...state, isVisible: true };
    case 'MAP_HIDE':
      return { ...state, isVisible: false, selectedHospital: null };
    case 'MAP_SET_HOSPITALS':
      return { ...state, hospitals: action.payload };
    case 'MAP_SET_USER_LOCATION':
      return { ...state, userLocation: action.payload };
    case 'MAP_SELECT_HOSPITAL':
      return { ...state, selectedHospital: action.payload };
    default:
      return state;
  }
}

function medicalReducer(state: MedicalState, action: MedicalAction): MedicalState {
  switch (action.type) {
    case 'MEDICAL_START_PROCESSING':
      return { ...state, isProcessing: true };
    case 'MEDICAL_STOP_PROCESSING':
      return { ...state, isProcessing: false };
    case 'MEDICAL_SET_ASSESSMENT':
      return { ...state, currentAssessment: action.payload, isProcessing: false };
    case 'MEDICAL_ADD_CONVERSATION_ENTRY':
      return { 
        ...state, 
        conversationHistory: [...state.conversationHistory, action.payload] 
      };
    case 'MEDICAL_CLEAR_ASSESSMENT':
      return { ...state, currentAssessment: null };
    default:
      return state;
  }
}

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'UI_SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.payload };
    case 'UI_SHOW_BOTTOM_SHEET':
      return { ...state, showBottomSheet: true };
    case 'UI_HIDE_BOTTOM_SHEET':
      return { ...state, showBottomSheet: false };
    case 'UI_ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    case 'UI_REMOVE_NOTIFICATION':
      return { 
        ...state, 
        notifications: state.notifications.filter(n => n.id !== action.payload) 
      };
    case 'UI_SET_THEME':
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

// Main app reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'VOICE':
      return { ...state, voice: voiceReducer(state.voice, action.payload) };
    case 'CAMERA':
      return { ...state, camera: cameraReducer(state.camera, action.payload) };
    case 'MAP':
      return { ...state, map: mapReducer(state.map, action.payload) };
    case 'MEDICAL':
      return { ...state, medical: medicalReducer(state.medical, action.payload) };
    case 'UI':
      return { ...state, ui: uiReducer(state.ui, action.payload) };
    default:
      return state;
  }
}
// Context types
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
  initialState?: AppState;
}

export function AppStateProvider({ children, initialState = initialAppState }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const value = { state, dispatch };
  return React.createElement(AppContext.Provider, { value }, children);
}

// Hook to use app context
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error(`useAppContext must be used within an AppStateProvider`);
  }
  return context;
}
// Custom hooks for each state domain
export function useVoiceState() {
  const { state, dispatch } = useAppContext();
  
  return {
    ...state.voice,
    activate: () => dispatch({ type: 'VOICE', payload: { type: 'VOICE_ACTIVATE' } }),
    deactivate: () => dispatch({ type: 'VOICE', payload: { type: 'VOICE_DEACTIVATE' } }),
    startListening: () => dispatch({ type: 'VOICE', payload: { type: 'VOICE_START_LISTENING' } }),
    stopListening: () => dispatch({ type: 'VOICE', payload: { type: 'VOICE_STOP_LISTENING' } }),
    startProcessing: () => dispatch({ type: 'VOICE', payload: { type: 'VOICE_START_PROCESSING' } }),
    stopProcessing: () => dispatch({ type: 'VOICE', payload: { type: 'VOICE_STOP_PROCESSING' } }),
    updateTranscription: (text: string) => 
      dispatch({ type: 'VOICE', payload: { type: 'VOICE_UPDATE_TRANSCRIPTION', payload: text } }),
    updateAudioLevel: (level: number) => 
      dispatch({ type: 'VOICE', payload: { type: 'VOICE_UPDATE_AUDIO_LEVEL', payload: level } }),
    updateConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => 
      dispatch({ type: 'VOICE', payload: { type: 'VOICE_UPDATE_CONNECTION_STATUS', payload: status } }),
    updateQueueSize: (size: number) =>
      dispatch({ type: 'VOICE', payload: { type: 'VOICE_UPDATE_QUEUE_SIZE', payload: size } }),
    setProcessingQueue: (isProcessing: boolean) =>
      dispatch({ type: 'VOICE', payload: { type: 'VOICE_SET_PROCESSING_QUEUE', payload: isProcessing } }),
    setSession: (sessionId: string | null) =>
      dispatch({ type: 'VOICE', payload: { type: 'VOICE_SET_SESSION', payload: sessionId } })
  };
}

export function useCameraState() {
  const { state, dispatch } = useAppContext();
  
  return {
    ...state.camera,
    activate: () => dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_ACTIVATE' } }),
    deactivate: () => dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_DEACTIVATE' } }),
    setPermission: (hasPermission: boolean) => 
      dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_SET_PERMISSION', payload: hasPermission } }),
    setPreview: (imageUrl: string | null) => 
      dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_SET_PREVIEW', payload: imageUrl } }),
    startUpload: () => dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_START_UPLOAD' } }),
    updateUploadProgress: (progress: number) => 
      dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_UPDATE_UPLOAD_PROGRESS', payload: progress } }),
    completeUpload: (uploadId: string) => 
      dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_COMPLETE_UPLOAD', payload: uploadId } }),
    resetUpload: () => dispatch({ type: 'CAMERA', payload: { type: 'CAMERA_RESET_UPLOAD' } })
  };
}

export function useMapState() {
  const { state, dispatch } = useAppContext();
  
  return {
    ...state.map,
    show: () => dispatch({ type: 'MAP', payload: { type: 'MAP_SHOW' } }),
    hide: () => dispatch({ type: 'MAP', payload: { type: 'MAP_HIDE' } }),
    setHospitals: (hospitals: HospitalLocation[]) => 
      dispatch({ type: 'MAP', payload: { type: 'MAP_SET_HOSPITALS', payload: hospitals } }),
    setUserLocation: (location: Coordinates | null) => 
      dispatch({ type: 'MAP', payload: { type: 'MAP_SET_USER_LOCATION', payload: location } }),
    selectHospital: (hospitalId: string | null) => 
      dispatch({ type: 'MAP', payload: { type: 'MAP_SELECT_HOSPITAL', payload: hospitalId } })
  };
}

export function useMedicalState() {
  const { state, dispatch } = useAppContext();
  
  return {
    ...state.medical,
    startProcessing: () => dispatch({ type: 'MEDICAL', payload: { type: 'MEDICAL_START_PROCESSING' } }),
    stopProcessing: () => dispatch({ type: 'MEDICAL', payload: { type: 'MEDICAL_STOP_PROCESSING' } }),
    setAssessment: (assessment: MedicalResponse) => 
      dispatch({ type: 'MEDICAL', payload: { type: 'MEDICAL_SET_ASSESSMENT', payload: assessment } }),
    addConversationEntry: (entry: ConversationEntry) => 
      dispatch({ type: 'MEDICAL', payload: { type: 'MEDICAL_ADD_CONVERSATION_ENTRY', payload: entry } }),
    clearAssessment: () => dispatch({ type: 'MEDICAL', payload: { type: 'MEDICAL_CLEAR_ASSESSMENT' } })
  };
}

export function useUIState() {
  const { state, dispatch } = useAppContext();
  
  return {
    ...state.ui,
    setActivePanel: (panel: 'voice' | 'camera' | 'map' | 'report') => 
      dispatch({ type: 'UI', payload: { type: 'UI_SET_ACTIVE_PANEL', payload: panel } }),
    showBottomSheet: () => dispatch({ type: 'UI', payload: { type: 'UI_SHOW_BOTTOM_SHEET' } }),
    hideBottomSheet: () => dispatch({ type: 'UI', payload: { type: 'UI_HIDE_BOTTOM_SHEET' } }),
    addNotification: (notification: Notification) => 
      dispatch({ type: 'UI', payload: { type: 'UI_ADD_NOTIFICATION', payload: notification } }),
    removeNotification: (notificationId: string) => 
      dispatch({ type: 'UI', payload: { type: 'UI_REMOVE_NOTIFICATION', payload: notificationId } }),
    setTheme: (theme: 'light' | 'dark') => 
      dispatch({ type: 'UI', payload: { type: 'UI_SET_THEME', payload: theme } })
  };
}