import type { CreateTripRequest, ItineraryDay } from '../../../shared/src';
import { tripLengthInDays } from '../utils/date.js';

export async function generateItinerary(input: CreateTripRequest): Promise<ItineraryDay[]> {
  const days = Math.min(5, tripLengthInDays(input.startDate, input.endDate));
  return Array.from({ length: days }, (_, index) => ({
    dayNumber: index + 1,
    theme: index === 0 ? 'Arrival + city highlights' : `Explore ${input.destinationCity} - Day ${index + 1}`,
    activities: [
      { time: '09:00', name: 'Local breakfast spot', type: 'restaurant' },
      { time: '10:30', name: `${input.destinationCity} landmark walk`, type: 'attraction' },
      { time: '14:00', name: 'Museum or neighborhood visit', type: 'attraction' },
      { time: '19:00', name: 'Dinner reservation', type: 'restaurant' }
    ]
  }));
}
