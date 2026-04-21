import type { Handler } from 'aws-lambda';
import type { TripResult, CreateTripRequest } from '../../../shared/src';
import { estimateCosts } from '../domain/costEstimator.js';
import { loadConfig } from '../config.js';
import { TripsRepository } from '../repositories/tripsRepository.js';

interface FinalizeEvent extends CreateTripRequest {
  tripId: string;
  flightPlan: { flights: TripResult['flights'] };
  hotelPlan: { hotels: TripResult['hotels'] };
  carPlan: { carRentals: TripResult['carRentals'] };
  itineraryPlan: { itinerary: TripResult['itinerary'] };
  restaurantPlan: { restaurants: TripResult['restaurants'] };
  tipsPlan: { travelTips: TripResult['travelTips'] };
}

export const handler: Handler<FinalizeEvent> = async (event: any) => {
  const config = loadConfig();
  const repository = new TripsRepository(config.tripsTableName, config.resultsTableName);

  const result: TripResult = {
    tripId: event.tripId,
    flights: event.flightPlan.flights,
    hotels: event.hotelPlan.hotels,
    carRentals: event.carPlan.carRentals,
    itinerary: event.itineraryPlan.itinerary,
    restaurants: event.restaurantPlan.restaurants,
    travelTips: event.tipsPlan.travelTips,
    costSummary: estimateCosts({
      flights: event.flightPlan.flights,
      hotels: event.hotelPlan.hotels,
      carRentals: event.carPlan.carRentals,
      restaurants: event.restaurantPlan.restaurants
    }),
    generatedAt: new Date().toISOString()
  };

  await repository.putResult(result);
  await repository.updateTripStatus(event.tripId, 'COMPLETED');

  return result;
};
