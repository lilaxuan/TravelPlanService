import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import { assertCreateTripRequest, type CreateTripRequest, type TripRecord } from '../../../shared/src';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config.js';
import { TripsRepository } from '../repositories/tripsRepository.js';
import { sfn } from '../clients/stepFunctions.js';
import { jsonResponse } from '../utils/response.js';

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
  try {
    const body = JSON.parse(event.body ?? '{}') as unknown;
    assertCreateTripRequest(body);
    const input = body as CreateTripRequest;
    const config = loadConfig();
    const repository = new TripsRepository(config.tripsTableName, config.resultsTableName);

    const tripId = uuidv4();
    const now = new Date().toISOString();

    const record: TripRecord = {
      tripId,
      status: 'PLANNING',
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await repository.putTrip(record);

    await sfn.send(new StartExecutionCommand({
      stateMachineArn: config.tripPlannerStateMachineArn,
      input: JSON.stringify({ tripId, ...input })
    }));

    return jsonResponse(202, {
      data: {
        tripId,
        status: 'PLANNING'
      }
    });
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
