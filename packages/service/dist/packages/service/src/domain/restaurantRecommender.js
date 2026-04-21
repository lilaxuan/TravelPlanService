"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendRestaurants = recommendRestaurants;
async function recommendRestaurants(input) {
    return [
        {
            provider: 'OpenTable',
            title: `${input.destinationCity} signature dining`,
            bookingUrl: 'https://www.opentable.com/',
            cuisine: 'Local favorite',
            priceRange: '$$$',
            reservationRecommended: true,
            description: 'Popular dinner spot; reserve in advance if possible.'
        },
        {
            provider: 'Yelp',
            title: `${input.destinationCity} casual brunch`,
            bookingUrl: 'https://www.yelp.com/',
            cuisine: 'Brunch',
            priceRange: '$$',
            reservationRecommended: false
        }
    ];
}
