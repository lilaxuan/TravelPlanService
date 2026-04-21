"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const costEstimator_js_1 = require("../domain/costEstimator.js");
const config_js_1 = require("../config.js");
const tripsRepository_js_1 = require("../repositories/tripsRepository.js");
const handler = async (event) => {
    const config = (0, config_js_1.loadConfig)();
    const repository = new tripsRepository_js_1.TripsRepository(config.tripsTableName, config.resultsTableName);
    const result = {
        tripId: event.tripId,
        flights: event.flightPlan.flights,
        hotels: event.hotelPlan.hotels,
        carRentals: event.carPlan.carRentals,
        itinerary: event.itineraryPlan.itinerary,
        restaurants: event.restaurantPlan.restaurants,
        travelTips: event.tipsPlan.travelTips,
        costSummary: (0, costEstimator_js_1.estimateCosts)({
            flights: event.flightPlan.flights,
            hotels: event.hotelPlan.hotels,
            carRentals: event.carPlan.carRentals,
            restaurants: event.restaurantPlan.restaurants
        }),
        generatedAt: new Date().toISOString()
    };
    await repository.putResult(result);
    await repository.updateTripStatus(event.tripId, 'COMPLETED');
    return result;
};
exports.handler = handler;
