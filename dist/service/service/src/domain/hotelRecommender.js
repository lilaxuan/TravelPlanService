"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendHotels = recommendHotels;
const deepLinks_js_1 = require("../utils/deepLinks.js");
const date_js_1 = require("../utils/date.js");
async function recommendHotels(input) {
    const nights = (0, date_js_1.tripLengthInDays)(input.startDate, input.endDate);
    const nightly = Math.max(120, Math.round((input.budget * 0.35) / nights));
    return [
        {
            provider: 'Booking.com',
            title: `${input.destinationCity} central stay`,
            bookingUrl: (0, deepLinks_js_1.buildHotelSearchUrl)(input.destinationCity, input.startDate, input.endDate),
            nightlyPrice: nightly,
            totalEstimatedPrice: nightly * nights,
            estimatedPrice: nightly * nights,
            currency: 'USD',
            area: 'City Center',
            description: 'Balanced option with strong location value.'
        },
        {
            provider: 'Airbnb',
            title: `${input.destinationCity} apartment option`,
            bookingUrl: 'https://www.airbnb.com/',
            nightlyPrice: nightly + 30,
            totalEstimatedPrice: (nightly + 30) * nights,
            estimatedPrice: (nightly + 30) * nights,
            currency: 'USD',
            area: 'Popular neighborhood'
        }
    ];
}
