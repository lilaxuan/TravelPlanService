import type { CarRentalOption, CostSummary, FlightOption, HotelOption, RestaurantOption } from '../../../shared/src';

export function estimateCosts(input: {
  flights: FlightOption[];
  hotels: HotelOption[];
  carRentals: CarRentalOption[];
  restaurants: RestaurantOption[];
}): CostSummary {
  const flights = input.flights[0]?.estimatedPrice ?? 0;
  const accommodations = input.hotels[0]?.totalEstimatedPrice ?? input.hotels[0]?.estimatedPrice ?? 0;
  const transportation = input.carRentals[0]?.estimatedPrice ?? 0;
  const foodEstimate = Math.max(120, input.restaurants.length * 45);
  const activitiesEstimate = 100;
  const total = flights + accommodations + transportation + foodEstimate + activitiesEstimate;
  return {
    flights,
    accommodations,
    transportation,
    foodEstimate,
    activitiesEstimate,
    total,
    currency: 'USD'
  };
}
