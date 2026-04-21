"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const config_js_1 = require("../config.js");
const tripsRepository_js_1 = require("../repositories/tripsRepository.js");
const response_js_1 = require("../utils/response.js");
const handler = async (event) => {
    try {
        const tripId = event.pathParameters?.tripId;
        if (!tripId) {
            return (0, response_js_1.jsonResponse)(400, { error: 'tripId is required' });
        }
        const config = (0, config_js_1.loadConfig)();
        const repository = new tripsRepository_js_1.TripsRepository(config.tripsTableName, config.resultsTableName);
        const trip = await repository.getTrip(tripId);
        if (!trip) {
            return (0, response_js_1.jsonResponse)(404, { error: 'Trip not found' });
        }
        const result = await repository.getResult(tripId);
        return (0, response_js_1.jsonResponse)(200, {
            data: {
                trip,
                result: result ?? null
            }
        });
    }
    catch (error) {
        return (0, response_js_1.jsonResponse)(500, {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.handler = handler;
