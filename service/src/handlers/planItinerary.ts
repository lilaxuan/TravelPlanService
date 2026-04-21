import type { Handler } from 'aws-lambda';
import type { CreateTripRequest } from '../../../shared/src';
import { generateItinerary } from '../domain/itineraryGenerator.js';

export const handler: Handler<CreateTripRequest> = async (event: any) => {
  return { itinerary: await generateItinerary(event) };
};
