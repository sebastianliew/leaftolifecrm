// This file initializes scheduled jobs when imported
// It should be imported by at least one server-side module to ensure jobs are started

// jobRunner import removed as it's not used

// This will only run once when the module is first imported
let initialized = false;

export function initializeJobs() {
  if (initialized) {
    return;
  }

  // Initializing scheduled jobs system
  
  // The jobRunner will handle its own initialization based on environment
  // This just ensures the module is loaded
  
  initialized = true;
}

// Auto-initialize when imported in production
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_JOBS === 'true') {
  initializeJobs();
}