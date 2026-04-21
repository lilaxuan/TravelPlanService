import type { CarRentalOption, CreateTripRequest } from '../../../shared/src';
import { buildCarRentalSearchUrl } from '../utils/deepLinks.js';

export async function recommendCarRentals(input: CreateTripRequest): Promise<CarRentalOption[]> {
  return [
    {
      provider: 'Expedia Cars',
      title: `${input.destinationCity} standard rental`,
      bookingUrl: buildCarRentalSearchUrl(input.destinationCity, input.startDate, input.endDate),
      estimatedPrice: 240,
      currency: 'USD',
      company: 'Partner rental providers',
      pickupLocation: `${input.destinationCity} airport`
    }
  ];
}
