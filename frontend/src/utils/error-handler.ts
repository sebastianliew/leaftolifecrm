import { NextResponse } from 'next/server';

interface MongoError {
  code: number;
  message: string;
}

interface ValidationError {
  name: string;
  errors: Record<string, { message: string }>;
}

export function isMongoError(error: unknown): error is MongoError {
  return error !== null && 
         typeof error === 'object' && 
         'code' in error && 
         typeof (error as MongoError).code === 'number';
}

export function isValidationError(error: unknown): error is ValidationError {
  return error !== null && 
         typeof error === 'object' && 
         'name' in error && 
         (error as ValidationError).name === 'ValidationError' &&
         'errors' in error;
}

export function handleDatabaseError(error: unknown, operation: string) {
  console.error(`Error ${operation}:`, error);
  
  if (isMongoError(error) && error.code === 11000) {
    return NextResponse.json(
      { error: 'A record with this information already exists' },
      { status: 409 }
    );
  }
  
  if (isValidationError(error)) {
    const validationErrors = Object.values(error.errors).map((err) => err.message);
    return NextResponse.json(
      { error: 'Validation failed', details: validationErrors },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: `Failed to ${operation}` },
    { status: 500 }
  );
} 