/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" (default): in-browser simulator. "http": the Worker backend. */
  readonly VITE_API_MODE?: "mock" | "http";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
