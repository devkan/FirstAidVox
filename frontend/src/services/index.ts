export { BackendService, backendService } from './backendService';
export type { AgentRequest, AgentResponse, ConversationMessage, ConversationalRequest, ApiError } from './backendService';

export { VoiceAgent, createVoiceAgent, defaultVoiceConfig } from './voiceAgent';
export type { VoiceAgentConfig, VoiceAgentCallbacks } from './voiceAgent';