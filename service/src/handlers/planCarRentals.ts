import type { Handler } from 'aws-lambda';
import type { CreateTripRequest } from '../../../shared/src';
import { recommendCarRentals } from '../domain/carRentalRecommender.js';

export const handler: Handler<CreateTripRequest> = async (event: any) => {
  return { carRentals: await recommendCarRentals(event) };
};
