"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const itineraryGenerator_js_1 = require("../domain/itineraryGenerator.js");
const handler = async (event) => {
    return { itinerary: await (0, itineraryGenerator_js_1.generateItinerary)(event) };
};
exports.handler = handler;
