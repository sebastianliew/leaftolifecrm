// Polyfills for globalThis and Proxy
if (typeof globalThis === 'undefined') {
  (window as Window).globalThis = window;
}

if (typeof Proxy === 'undefined') {
  console.warn('Proxy is not supported in this environment. Some features may not work correctly.');
}

export {}; 