/**
 * Sanitization utilities for preventing XSS attacks
 * Uses basic HTML escaping for server-side rendering
 * For client-side, use React's built-in XSS protection
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export const escapeHtml = (unsafe: string): string => {
  if (typeof unsafe !== 'string') return '';
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Sanitize content for safe HTML rendering
 * Allows only basic formatting tags
 */
export const sanitizeHtml = (dirty: string): string => {
  if (typeof dirty !== 'string') return '';
  
  // For server-side, we'll escape everything
  // For client-side with DOMPurify, this would allow certain tags
  return escapeHtml(dirty);
};

/**
 * Sanitize content specifically for printing
 * More restrictive than general HTML sanitization
 */
export const sanitizeForPrint = (content: string): string => {
  if (typeof content !== 'string') return '';
  
  // Remove any potential script tags or event handlers
  const cleaned = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
  
  return escapeHtml(cleaned);
};

/**
 * Sanitize user input for display
 * Prevents XSS while maintaining readability
 */
export const sanitizeUserInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  // Trim and escape
  return escapeHtml(input.trim());
};

/**
 * Create safe HTML for prescription printing
 * Specifically designed for the prescription printing feature
 */
export const createSafePrintHtml = (data: {
  patientName: string;
  date: string;
  instructions: Array<{ instruction: string }>;
  doctorName?: string;
  clinicName?: string;
}): string => {
  const safeData = {
    patientName: sanitizeForPrint(data.patientName),
    date: sanitizeForPrint(data.date),
    instructions: data.instructions.map(inst => ({
      instruction: sanitizeForPrint(inst.instruction)
    })),
    doctorName: data.doctorName ? sanitizeForPrint(data.doctorName) : '',
    clinicName: data.clinicName ? sanitizeForPrint(data.clinicName) : ''
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Prescription - ${safeData.patientName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2, h3 { color: #333; }
          .header { margin-bottom: 30px; }
          .patient-info { margin-bottom: 20px; }
          .instructions { margin-top: 20px; }
          .instruction-item { margin: 10px 0; padding-left: 20px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Medical Prescription</h1>
          ${safeData.clinicName ? `<h2>${safeData.clinicName}</h2>` : ''}
        </div>
        
        <div class="patient-info">
          <p><strong>Patient Name:</strong> ${safeData.patientName}</p>
          <p><strong>Date:</strong> ${safeData.date}</p>
        </div>
        
        <div class="instructions">
          <h3>Instructions:</h3>
          ${safeData.instructions
            .map(inst => `<div class="instruction-item">• ${inst.instruction}</div>`)
            .join('')}
        </div>
        
        ${safeData.doctorName ? `
        <div class="footer">
          <p><strong>Prescribed by:</strong> ${safeData.doctorName}</p>
        </div>
        ` : ''}
      </body>
    </html>
  `;
};

/**
 * Validate and sanitize MongoDB ObjectId
 */
export const sanitizeObjectId = (id: string): string => {
  // MongoDB ObjectIds are 24-character hex strings
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    throw new Error('Invalid ObjectId format');
  }
  
  return id;
};

/**
 * Sanitize search query parameters
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (typeof query !== 'string') return '';
  
  // Remove special characters that could be used for injection
  return query
    .replace(/[<>"']/g, '')
    .substring(0, 100) // Limit length
    .trim();
};