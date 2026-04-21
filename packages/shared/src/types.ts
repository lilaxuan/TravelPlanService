export type TripStatus = 'DRAFT' | 'PLANNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_SUCCESS';

export interface TripPreferences {
  accommodationType?: 'hotel' | 'airbnb' | 'hostel';
  transportationType?: 'car_rental' | 'public_transit' | 'walking' | 'none';
  activityTypes?: string[];
  diningPreferences?: string[];
}

export interface CreateTripRequest {
  departureCity: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  budget: number;
  travelers: number;
  preferences?: TripPreferences;
}

export interface TripRecord extends CreateTripRequest {
  tripId: string;
  userId?: string;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationLink {
  provider: string;
  title: string;
  bookingUrl: string;
  estimatedPrice?: number;
  currency?: string;
  description?: string;
}

export interface FlightOption extends RecommendationLink {
  duration?: string;
}

export interface HotelOption extends RecommendationLink {
  area?: string;
  nightlyPrice?: number;
  totalEstimatedPrice?: number;
}

export interface CarRentalOption extends RecommendationLink {
  company?: string;
  pickupLocation?: string;
}

export interface ActivityItem {
  time: string;
  name: string;
  type: 'attraction' | 'restaurant' | 'transport' | 'free_time';
  notes?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  activities: ActivityItem[];
}

export interface RestaurantOption extends RecommendationLink {
  cuisine?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  reservationRecommended?: boolean;
}

export interface TravelTips {
  visaGuidance: string;
  bestSeason: string;
  localTransportation: string;
  packingTip?: string;
}

export interface CostSummary {
  flights: number;
  accommodations: number;
  transportation: number;
  foodEstimate: number;
  activitiesEstimate: number;
  total: number;
  currency: string;
}

export interface TripResult {
  tripId: string;
  flights: FlightOption[];
  hotels: HotelOption[];
  carRentals: CarRentalOption[];
  itinerary: ItineraryDay[];
  restaurants: RestaurantOption[];
  travelTips: TravelTips;
  costSummary: CostSummary;
  generatedAt: string;
  warnings?: string[];
}

export interface ApiResponse<T> {
  data: T;
}
