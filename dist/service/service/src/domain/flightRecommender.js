"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendFlights = recommendFlights;
const deepLinks_js_1 = require("../utils/deepLinks.js");
async function recommendFlights(input) {
    const baseUrl = (0, deepLinks_js_1.buildFlightSearchUrl)(input.departureCity, input.destinationCity, input.startDate, input.endDate);
    return [
        {
            provider: 'Google Flights',
            title: `Top flight from ${input.departureCity} to ${input.destinationCity}`,
            bookingUrl: baseUrl,
            estimatedPrice: Math.round(input.budget * 0.22),
            currency: 'USD',
            duration: '2h 30m',
            description: 'Suggested based on budget-friendly direct options.'
        },
        {
            provider: 'Expedia',
            title: 'Alternative flight option',
            bookingUrl: `https://www.expedia.com/Flights`,
            estimatedPrice: Math.round(input.budget * 0.26),
            currency: 'USD',
            duration: '3h 10m'
        }
    ];
}
