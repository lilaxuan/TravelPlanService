"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const config_js_1 = require("../config.js");
const tripsRepository_js_1 = require("../repositories/tripsRepository.js");
const handler = async (event) => {
    if (!event.tripId) {
        return { ok: false, reason: 'Missing tripId' };
    }
    const config = (0, config_js_1.loadConfig)();
    const repository = new tripsRepository_js_1.TripsRepository(config.tripsTableName, config.resultsTableName);
    await repository.updateTripStatus(event.tripId, 'FAILED');
    return { ok: true, tripId: event.tripId, cause: event.cause ?? 'Unknown cause' };
};
exports.handler = handler;
