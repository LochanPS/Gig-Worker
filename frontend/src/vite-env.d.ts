/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin in production (e.g. https://gigbridge-api.up.railway.app). Empty in dev. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
