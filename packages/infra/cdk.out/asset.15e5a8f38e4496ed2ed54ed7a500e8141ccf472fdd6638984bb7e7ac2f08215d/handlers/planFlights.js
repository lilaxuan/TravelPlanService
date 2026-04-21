"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const flightRecommender_js_1 = require("../domain/flightRecommender.js");
const handler = async (event) => {
    return { flights: await (0, flightRecommender_js_1.recommendFlights)(event) };
};
exports.handler = handler;
