"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFlightSearchUrl = buildFlightSearchUrl;
exports.buildHotelSearchUrl = buildHotelSearchUrl;
exports.buildCarRentalSearchUrl = buildCarRentalSearchUrl;
function buildFlightSearchUrl(departureCity, destinationCity, startDate, endDate) {
    const params = new URLSearchParams({
        from: departureCity,
        to: destinationCity,
        departure: startDate,
        return: endDate
    });
    return `https://www.google.com/travel/flights?${params.toString()}`;
}
function buildHotelSearchUrl(destinationCity, startDate, endDate) {
    const params = new URLSearchParams({
        ss: destinationCity,
        checkin: startDate,
        checkout: endDate
    });
    return `https://www.booking.com/searchresults.html?${params.toString()}`;
}
function buildCarRentalSearchUrl(destinationCity, startDate, endDate) {
    const params = new URLSearchParams({
        pickup: destinationCity,
        start: startDate,
        end: endDate
    });
    return `https://www.expedia.com/Cars?${params.toString()}`;
}
