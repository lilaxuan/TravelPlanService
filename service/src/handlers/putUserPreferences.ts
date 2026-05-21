import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../clients/dynamo.js';
import { jsonResponse } from '../utils/response.js';

const TABLE = process.env.USERS_TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims['sub'] as string;

    if (!event.body) return jsonResponse(400, { error: 'Body required' });

    const prefs = JSON.parse(event.body) as Record<string, unknown>;

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: 'PREFERENCES',
        userId,
        updatedAt: new Date().toISOString(),
        ...prefs,
      },
    }));

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
