"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const costEstimator_js_1 = require("../domain/costEstimator.js");
(0, node_test_1.default)('estimateCosts returns total greater than zero', () => {
    const summary = (0, costEstimator_js_1.estimateCosts)({
        flights: [{ provider: 'x', title: 'x', bookingUrl: 'https://a', estimatedPrice: 100 }],
        hotels: [{ provider: 'x', title: 'x', bookingUrl: 'https://a', totalEstimatedPrice: 300 }],
        carRentals: [{ provider: 'x', title: 'x', bookingUrl: 'https://a', estimatedPrice: 50 }],
        restaurants: [{ provider: 'x', title: 'x', bookingUrl: 'https://a' }]
    });
    strict_1.default.equal(summary.total > 0, true);
});
