"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const hotelRecommender_js_1 = require("../domain/hotelRecommender.js");
const handler = async (event) => {
    return { hotels: await (0, hotelRecommender_js_1.recommendHotels)(event) };
};
exports.handler = handler;
