"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sfn_1 = require("@aws-sdk/client-sfn");
const src_1 = require("../../../shared/src");
const uuid_1 = require("uuid");
const config_js_1 = require("../config.js");
const tripsRepository_js_1 = require("../repositories/tripsRepository.js");
const stepFunctions_js_1 = require("../clients/stepFunctions.js");
const response_js_1 = require("../utils/response.js");
const handler = async (event) => {
    try {
        const body = JSON.parse(event.body ?? '{}');
        (0, src_1.assertCreateTripRequest)(body);
        const input = body;
        const config = (0, config_js_1.loadConfig)();
        const repository = new tripsRepository_js_1.TripsRepository(config.tripsTableName, config.resultsTableName);
        const tripId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const record = {
            tripId,
            status: 'PLANNING',
            createdAt: now,
            updatedAt: now,
            ...input
        };
        await repository.putTrip(record);
        await stepFunctions_js_1.sfn.send(new client_sfn_1.StartExecutionCommand({
            stateMachineArn: config.tripPlannerStateMachineArn,
            input: JSON.stringify({ tripId, ...input })
        }));
        return (0, response_js_1.jsonResponse)(202, {
            data: {
                tripId,
                status: 'PLANNING'
            }
        });
    }
    catch (error) {
        return (0, response_js_1.jsonResponse)(400, {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.handler = handler;
