"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECOMMENDATION_SECTIONS = exports.TRIP_STATUS = exports.DEFAULT_CURRENCY = exports.DEFAULT_REGION = exports.APP_NAME = void 0;
exports.APP_NAME = 'GoNow';
exports.DEFAULT_REGION = 'us-west-2';
exports.DEFAULT_CURRENCY = 'USD';
exports.TRIP_STATUS = {
    DRAFT: 'DRAFT',
    PLANNING: 'PLANNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    PARTIAL_SUCCESS: 'PARTIAL_SUCCESS'
};
exports.RECOMMENDATION_SECTIONS = [
    'flights',
    'hotels',
    'carRentals',
    'itinerary',
    'restaurants',
    'travelTips',
    'costSummary'
];
