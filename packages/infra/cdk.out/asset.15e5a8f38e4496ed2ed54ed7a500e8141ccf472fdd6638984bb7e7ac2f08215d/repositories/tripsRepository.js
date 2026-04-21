"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripsRepository = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamo_js_1 = require("../clients/dynamo.js");
class TripsRepository {
    constructor(tripsTableName, resultsTableName) {
        this.tripsTableName = tripsTableName;
        this.resultsTableName = resultsTableName;
    }
    async putTrip(trip) {
        await dynamo_js_1.ddb.send(new lib_dynamodb_1.PutCommand({
            TableName: this.tripsTableName,
            Item: trip
        }));
    }
    async getTrip(tripId) {
        const response = await dynamo_js_1.ddb.send(new lib_dynamodb_1.GetCommand({
            TableName: this.tripsTableName,
            Key: { tripId }
        }));
        return response.Item;
    }
    async updateTripStatus(tripId, status) {
        await dynamo_js_1.ddb.send(new lib_dynamodb_1.UpdateCommand({
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
    async putResult(result) {
        await dynamo_js_1.ddb.send(new lib_dynamodb_1.PutCommand({
            TableName: this.resultsTableName,
            Item: result
        }));
    }
    async getResult(tripId) {
        const response = await dynamo_js_1.ddb.send(new lib_dynamodb_1.GetCommand({
            TableName: this.resultsTableName,
            Key: { tripId }
        }));
        return response.Item;
    }
}
exports.TripsRepository = TripsRepository;
