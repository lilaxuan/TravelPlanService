import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { TripRecord, TripResult, TripStatus } from '../../../shared/src';
import { ddb } from '../clients/dynamo.js';

export class TripsRepository {
  constructor(
    private readonly tripsTableName: string,
    private readonly resultsTableName: string
  ) {}

  async putTrip(trip: TripRecord): Promise<void> {
    await ddb.send(new PutCommand({
      TableName: this.tripsTableName,
      Item: trip
    }));
  }

  async getTrip(tripId: string): Promise<TripRecord | undefined> {
    const response = await ddb.send(new GetCommand({
      TableName: this.tripsTableName,
      Key: { tripId }
    }));
    return response.Item as TripRecord | undefined;
  }

  async updateTripStatus(tripId: string, status: TripStatus): Promise<void> {
    await ddb.send(new UpdateCommand({
      TableName: this.tripsTableName,
      Key: { tripId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      }
    }));
  }

  async putResult(result: TripResult): Promise<void> {
    await ddb.send(new PutCommand({
      TableName: this.resultsTableName,
      Item: result
    }));
  }

  async getResult(tripId: string): Promise<TripResult | undefined> {
    const response = await ddb.send(new GetCommand({
      TableName: this.resultsTableName,
      Key: { tripId }
    }));
    return response.Item as TripResult | undefined;
  }
}
