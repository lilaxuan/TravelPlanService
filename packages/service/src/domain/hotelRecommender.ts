import type { CreateTripRequest, HotelOption } from '../../../shared/src';
import { buildHotelSearchUrl } from '../utils/deepLinks.js';
import { tripLengthInDays } from '../utils/date.js';

export async function recommendHotels(input: CreateTripRequest): Promise<HotelOption[]> {
  const nights = tripLengthInDays(input.startDate, input.endDate);
  const nightly = Math.max(120, Math.round((input.budget * 0.35) / nights));
  return [
    {
      provider: 'Booking.com',
      title: `${input.destinationCity} central stay`,
      bookingUrl: buildHotelSearchUrl(input.destinationCity, input.startDate, input.endDate),
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
