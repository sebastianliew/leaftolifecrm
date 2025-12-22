export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

export function parseApiError(error: unknown): {
  message: string;
  field?: string;
  code?: string;
} {
  const message = getErrorMessage(error);
  
  // Common error patterns
  if (message.includes('Unit of measurement not found')) {
    return {
      message: 'One or more ingredients have invalid unit of measurement. Please remove and re-add the ingredients.',
      field: 'ingredients',
      code: 'INVALID_UNIT'
    };
  }
  
  if (message.includes('Product not found')) {
    return {
      message: 'One or more ingredients reference products that no longer exist. Please remove and re-add the ingredients.',
      field: 'ingredients',
      code: 'INVALID_PRODUCT'
    };
  }
  
  if (message.includes('required')) {
    const field = message.match(/(\w+) is required/)?.[1];
    return {
      message,
      field: field?.toLowerCase(),
      code: 'REQUIRED_FIELD'
    };
  }
  
  return { message, code: 'UNKNOWN' };
}