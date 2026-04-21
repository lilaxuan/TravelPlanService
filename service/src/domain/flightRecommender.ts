import type { CreateTripRequest, FlightOption } from '../../../shared/src';
import { buildFlightSearchUrl } from '../utils/deepLinks.js';

export async function recommendFlights(input: CreateTripRequest): Promise<FlightOption[]> {
  const baseUrl = buildFlightSearchUrl(input.departureCity, input.destinationCity, input.startDate, input.endDate);
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
