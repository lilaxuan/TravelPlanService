import type { Handler } from 'aws-lambda';
import type { CreateTripRequest } from '../../../shared/src';
import { recommendFlights } from '../domain/flightRecommender.js';

export const handler: Handler<CreateTripRequest> = async (event: any) => {
  return { flights: await recommendFlights(event) };
};
