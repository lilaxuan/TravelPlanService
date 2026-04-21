import type { CreateTripRequest, RestaurantOption } from '../../../shared/src';

export async function recommendRestaurants(input: CreateTripRequest): Promise<RestaurantOption[]> {
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
