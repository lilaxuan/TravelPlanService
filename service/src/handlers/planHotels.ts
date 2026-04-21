import type { Handler } from 'aws-lambda';
import type { CreateTripRequest } from '../../../shared/src';
import { recommendHotels } from '../domain/hotelRecommender.js';

export const handler: Handler<CreateTripRequest> = async (event: any) => {
  return { hotels: await recommendHotels(event) };
};
