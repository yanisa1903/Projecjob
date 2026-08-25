/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TAT_API_KEY?: string;
  readonly VITE_TMD_API_KEY?: string;
  readonly VITE_WINDY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}