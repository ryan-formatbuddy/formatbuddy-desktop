import type { FbBridge } from "./index";

declare global {
  interface Window {
    fb: FbBridge;
  }
}

export {};
