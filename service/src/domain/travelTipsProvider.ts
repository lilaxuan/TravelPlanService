import type { CreateTripRequest, TravelTips } from '../../../shared/src';

export async function getTravelTips(input: CreateTripRequest): Promise<TravelTips> {
  return {
    visaGuidance: `Check official entry requirements for travel to ${input.destinationCity}. Guidance shown here is informational only.`,
    bestSeason: `Spring and fall are generally strong seasons to visit ${input.destinationCity}.`,
    localTransportation: `Use a mix of public transit and walking in ${input.destinationCity} unless you plan day trips outside the city.`,
    packingTip: 'Pack layers and comfortable walking shoes.'
  };
}
