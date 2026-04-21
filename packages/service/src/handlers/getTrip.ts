import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { loadConfig } from '../config.js';
import { TripsRepository } from '../repositories/tripsRepository.js';
import { jsonResponse } from '../utils/response.js';

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
  try {
    const tripId = event.pathParameters?.tripId;
    if (!tripId) {
      return jsonResponse(400, { error: 'tripId is required' });
    }

    const config = loadConfig();
    const repository = new TripsRepository(config.tripsTableName, config.resultsTableName);
    const trip = await repository.getTrip(tripId);

    if (!trip) {
      return jsonResponse(404, { error: 'Trip not found' });
    }

    const result = await repository.getResult(tripId);
    return jsonResponse(200, {
      data: {
        trip,
        result: result ?? null
      }
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
