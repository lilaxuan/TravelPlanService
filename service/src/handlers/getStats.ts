import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../clients/dynamo.js';
import { jsonResponse } from '../utils/response.js';

const TABLE = process.env.USERS_TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: 'METRICS', SK: 'USERS' },
      }),
    );
    const count = typeof res.Item?.count === 'number' ? res.Item.count : 0;
    return jsonResponse(200, { totalUsers: count });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
