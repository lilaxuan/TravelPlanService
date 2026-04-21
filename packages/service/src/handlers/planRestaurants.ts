import type { Handler } from 'aws-lambda';
import type { CreateTripRequest } from '../../../shared/src';
import { recommendRestaurants } from '../domain/restaurantRecommender.js';

export const handler: Handler<CreateTripRequest> = async (event: any) => {
  return { restaurants: await recommendRestaurants(event) };
};
