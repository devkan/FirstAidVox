/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_ELEVENLABS_API_KEY: string
  readonly VITE_ELEVENLABS_AGENT_ID: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly MODE: string
  readonly VITEST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}