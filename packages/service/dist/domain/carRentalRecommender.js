"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendCarRentals = recommendCarRentals;
const deepLinks_js_1 = require("../utils/deepLinks.js");
async function recommendCarRentals(input) {
    return [
        {
            provider: 'Expedia Cars',
            title: `${input.destinationCity} standard rental`,
            bookingUrl: (0, deepLinks_js_1.buildCarRentalSearchUrl)(input.destinationCity, input.startDate, input.endDate),
            estimatedPrice: 240,
            currency: 'USD',
            company: 'Partner rental providers',
            pickupLocation: `${input.destinationCity} airport`
        }
    ];
}
