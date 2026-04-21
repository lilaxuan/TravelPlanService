export function buildFlightSearchUrl(departureCity: string, destinationCity: string, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    from: departureCity,
    to: destinationCity,
    departure: startDate,
    return: endDate
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

export function buildHotelSearchUrl(destinationCity: string, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    ss: destinationCity,
    checkin: startDate,
    checkout: endDate
  });
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function buildCarRentalSearchUrl(destinationCity: string, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    pickup: destinationCity,
    start: startDate,
    end: endDate
  });
  return `https://www.expedia.com/Cars?${params.toString()}`;
}
