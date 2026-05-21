import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../clients/dynamo.js';
import { jsonResponse } from '../utils/response.js';

const TABLE = process.env.USERS_TABLE_NAME!;

async function incrementUserCounter(): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: 'METRICS', SK: 'USERS' },
        UpdateExpression: 'ADD #c :one',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: { ':one': 1 },
      }),
    );
  } catch {
    // Best-effort — don't fail the profile fetch if the metrics write hiccups.
  }
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;

    const [profileRes, prefsRes] = await Promise.all([
      ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: 'PROFILE' } })),
      ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: 'PREFERENCES' } })),
    ]);

    let profile = profileRes.Item ?? null;

    // Auto-create profile on first access
    if (!profile) {
      const email = event.requestContext.authorizer.jwt.claims['email'] as string;
      const newProfile = { PK: `USER#${userId}`, SK: 'PROFILE', email, userId, createdAt: new Date().toISOString() };
      try {
        await ddb.send(new PutCommand({
          TableName: TABLE,
          Item: newProfile,
          ConditionExpression: 'attribute_not_exists(PK)',
        }));
        profile = newProfile;
        // Only increment when *this* call actually created the row.
        await incrementUserCounter();
      } catch {
        // Race: another concurrent call already created it — re-read.
        const reread = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: 'PROFILE' } }));
        profile = reread.Item ?? null;
      }
    }

    return jsonResponse(200, {
      profile,
      preferences: prefsRes.Item ?? null,
    });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
