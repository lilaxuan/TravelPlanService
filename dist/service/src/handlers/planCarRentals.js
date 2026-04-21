"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const carRentalRecommender_js_1 = require("../domain/carRentalRecommender.js");
const handler = async (event) => {
    return { carRentals: await (0, carRentalRecommender_js_1.recommendCarRentals)(event) };
};
exports.handler = handler;
