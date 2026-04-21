export const APP_NAME = 'GoNow';
export const DEFAULT_REGION = 'us-west-2';
export const DEFAULT_CURRENCY = 'USD';

export const TRIP_STATUS = {
  DRAFT: 'DRAFT',
  PLANNING: 'PLANNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS'
} as const;

export const RECOMMENDATION_SECTIONS = [
  'flights',
  'hotels',
  'carRentals',
  'itinerary',
  'restaurants',
  'travelTips',
  'costSummary'
] as const;
