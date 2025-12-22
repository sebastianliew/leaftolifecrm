export {}; // Make this an external module

declare global {
  interface Window {
    globalThis: Window;
  }
} 