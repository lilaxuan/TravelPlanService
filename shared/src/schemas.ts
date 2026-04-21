import type { CreateTripRequest } from './types.js';

export function assertCreateTripRequest(input: unknown): asserts input is CreateTripRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('Request body must be an object');
  }

  const value = input as Record<string, unknown>;
  const requiredStringFields = ['departureCity', 'destinationCity', 'startDate', 'endDate'];
  for (const field of requiredStringFields) {
    if (typeof value[field] !== 'string' || value[field]?.toString().trim() === '') {
      throw new Error(`Missing or invalid field: ${field}`);
    }
  }

  if (typeof value.budget !== 'number' || value.budget <= 0) {
    throw new Error('Missing or invalid field: budget');
  }

  if (typeof value.travelers !== 'number' || value.travelers <= 0) {
    throw new Error('Missing or invalid field: travelers');
  }
}
