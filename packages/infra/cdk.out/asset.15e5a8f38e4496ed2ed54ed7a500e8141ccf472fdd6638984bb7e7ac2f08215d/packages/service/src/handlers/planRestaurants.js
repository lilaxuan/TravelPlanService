"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const restaurantRecommender_js_1 = require("../domain/restaurantRecommender.js");
const handler = async (event) => {
    return { restaurants: await (0, restaurantRecommender_js_1.recommendRestaurants)(event) };
};
exports.handler = handler;
