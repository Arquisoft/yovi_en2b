/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEST_PASSWORD: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
