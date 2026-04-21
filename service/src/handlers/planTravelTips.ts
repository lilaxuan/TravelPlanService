import type { Handler } from 'aws-lambda';
import type { CreateTripRequest } from '../../../shared/src';
import { getTravelTips } from '../domain/travelTipsProvider.js';

export const handler: Handler<CreateTripRequest> = async (event: any) => {
  return { travelTips: await getTravelTips(event) };
};
