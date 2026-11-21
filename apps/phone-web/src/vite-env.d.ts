/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock": in-browser simulator (dev default). "http": the worker in apps/worker (production default). */
  readonly VITE_API_MODE?: "mock" | "http";
  /** http mode: car id the C1 "Check in" button taps when there is no NFC tag (dev/demo only). */
  readonly VITE_DEMO_CAR?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
