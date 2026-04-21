import type { Handler } from 'aws-lambda';
import { loadConfig } from '../config.js';
import { TripsRepository } from '../repositories/tripsRepository.js';

interface FailureEvent {
  tripId?: string;
  cause?: string;
}

export const handler: Handler<FailureEvent> = async (event: any) => {
  if (!event.tripId) {
    return { ok: false, reason: 'Missing tripId' };
  }

  const config = loadConfig();
  const repository = new TripsRepository(config.tripsTableName, config.resultsTableName);
  await repository.updateTripStatus(event.tripId, 'FAILED');

  return { ok: true, tripId: event.tripId, cause: event.cause ?? 'Unknown cause' };
};
