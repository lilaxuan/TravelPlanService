import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ddb } from '../clients/dynamo.js';
import { jsonResponse } from '../utils/response.js';

const RESULTS_TABLE = process.env.RESULTS_TABLE_NAME!;
const TRIP_CACHE_TABLE = process.env.TRIP_CACHE_TABLE_NAME;
const CACHE_TTL_SECONDS = Number(process.env.TRIP_CACHE_TTL_SECONDS ?? 86_400);
const OPENAI_SECTION_TIMEOUT_MS = Number(process.env.OPENAI_SECTION_TIMEOUT_MS ?? 18_000);

interface TripInput {
  departureCity: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  budget: number;
  travelers: number;
  preferences?: Record<string, unknown>;
}

interface GeneratedTripPayload {
  departureIata?: string;
  destinationIata?: string;
  flights: unknown[];
  hotels: unknown[];
  carRentals: unknown[];
  itinerary: unknown[];
  restaurants: unknown[];
  travelTips: Record<string, unknown>;
  costSummary: Record<string, unknown>;
  warnings?: string[];
}

function tripLengthInNights(startDate: string, endDate: string): number {
  return Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000));
}

function baseTripContext(input: TripInput): string {
  const nights = tripLengthInNights(input.startDate, input.endDate);

  return `You are a professional travel planner. Return only valid JSON. No markdown or extra text.
Trip details:
- Departure: ${input.departureCity}
- Destination: ${input.destinationCity}
- Dates: ${input.startDate} to ${input.endDate} (${nights} nights)
- Budget: $${input.budget} USD total
- Travelers: ${input.travelers}`;
}

function buildLogisticsPrompt(input: TripInput): string {
  return `${baseTripContext(input)}

Return JSON matching:
{
  "departureIata": string,
  "destinationIata": string,
  "flights": [{ "airline": string, "flightNumber": string, "departure": string, "arrival": string, "estimatedPrice": number, "duration": string, "stops": string }],
  "hotels": [{ "name": string, "area": string, "estimatedNightlyPrice": number, "totalEstimatedPrice": number, "starRating": number, "highlights": string }],
  "carRentals": [{ "provider": string, "estimatedTotalPrice": number, "pickupLocation": string, "bookingUrl": string }],
  "costSummary": { "flights": number, "hotels": number, "carRental": number, "foodEstimate": number, "activitiesEstimate": number, "total": number }
}
Requirements:
- Include 2-3 realistic flight options with real airline names, plausible flight numbers, and departure/arrival times
- Include 2-3 real well-known hotels with accurate star ratings and notable highlights
- Include 2-3 car rental options from different providers (Enterprise, Hertz, Budget, Avis)
- Keep total cost within $${input.budget} budget where possible`;
}

function buildItineraryPrompt(input: TripInput): string {
  const nights = tripLengthInNights(input.startDate, input.endDate);

  return `${baseTripContext(input)}

Return JSON matching:
{
  "itinerary": [{ "dayNumber": number, "theme": string, "activities": [{ "time": string, "name": string, "type": string, "notes": string | undefined, "transportFromPrevious": string | undefined, "lat": number, "lng": number }] }]
}
Requirements:
- Build a day-by-day itinerary for all ${nights} nights covering popular attractions, local food, and hidden gems
- For each activity include travel time/distance from previous spot in "transportFromPrevious" and accurate GPS coordinates (lat, lng)`;
}

function buildRestaurantsPrompt(input: TripInput): string {
  return `${baseTripContext(input)}

Return JSON matching:
{
  "restaurants": [{ "name": string, "cuisine": string, "priceRange": string, "reservationRecommended": boolean, "reservationUrl": string | undefined, "photoQuery": string }]
}
Requirements:
- Include 4-6 notable restaurants across different neighborhoods and price levels
- Prefer places a traveler could realistically search and book`;
}

function buildTipsPrompt(input: TripInput): string {
  return `${baseTripContext(input)}

Return JSON matching:
{
  "travelTips": { "bestSeasonSummary": string, "visaGuidance": string, "localTip": string, "weatherSummary": string, "clothingRecommendations": string, "preTravelReminders": string[] }
}
Requirements:
- Include weather summary, clothing recommendations, visa requirements, local transportation notes, and pre-travel reminders`;
}

function buildFallbackItinerary(input: TripInput): Array<Record<string, unknown>> {
  const days = tripLengthInNights(input.startDate, input.endDate);
  return Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    return {
      dayNumber,
      theme: dayNumber === 1 ? `${input.destinationCity} essentials` : `${input.destinationCity} neighborhoods and local flavor`,
      activities: [
        {
          time: '09:00',
          name: dayNumber === 1 ? `${input.destinationCity} downtown orientation` : `${input.destinationCity} neighborhood walk`,
          type: 'attraction',
          notes: 'Start with a central, easy-to-reach area and adjust based on weather and opening hours.',
          transportFromPrevious: 'Start from hotel',
        },
        {
          time: '12:30',
          name: 'Local lunch stop',
          type: 'restaurant',
          notes: 'Choose a well-reviewed casual restaurant near the morning activity.',
          transportFromPrevious: '10-15 min walk or short ride',
        },
        {
          time: '14:30',
          name: dayNumber === 1 ? 'Signature museum or landmark' : 'Park, market, or waterfront time',
          type: 'attraction',
          notes: 'Reserve tickets ahead if the attraction requires timed entry.',
          transportFromPrevious: '15-25 min by public transit or rideshare',
        },
        {
          time: '18:30',
          name: 'Dinner in a popular dining district',
          type: 'restaurant',
          notes: 'Make a reservation if traveling on a weekend.',
          transportFromPrevious: '15-20 min from afternoon stop',
        },
      ],
    };
  });
}

function buildFallbackRestaurants(input: TripInput): Array<Record<string, unknown>> {
  return [
    {
      name: `${input.destinationCity} local favorite`,
      cuisine: 'Regional',
      priceRange: '$$',
      reservationRecommended: true,
      photoQuery: `${input.destinationCity} popular restaurant`,
    },
    {
      name: `${input.destinationCity} casual lunch spot`,
      cuisine: 'Casual',
      priceRange: '$',
      reservationRecommended: false,
      photoQuery: `${input.destinationCity} lunch`,
    },
  ];
}

function buildFallbackTravelTips(input: TripInput): Record<string, unknown> {
  return {
    bestSeasonSummary: `Check current seasonal conditions for ${input.destinationCity} before departure.`,
    visaGuidance: 'Confirm ID, visa, and entry requirements based on your citizenship and route.',
    localTip: 'Keep a flexible first day and verify opening hours before heading out.',
    weatherSummary: 'Review the local forecast 48 hours before departure.',
    clothingRecommendations: 'Pack comfortable walking shoes and layers.',
    preTravelReminders: ['Confirm bookings', 'Check transit from the airport or station', 'Save offline maps'],
  };
}

async function requestJsonSection<T extends Record<string, unknown>>(apiKey: string, prompt: string): Promise<T> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1800,
    }),
    signal: AbortSignal.timeout(OPENAI_SECTION_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const completion = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = completion.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as T;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(value).digest('hex');
}

async function buildCacheKey(input: TripInput): Promise<string> {
  const normalized = {
    departureCity: input.departureCity.trim().toLowerCase(),
    destinationCity: input.destinationCity.trim().toLowerCase(),
    startDate: input.startDate,
    endDate: input.endDate,
    budget: Number(input.budget),
    travelers: Number(input.travelers),
    preferences: input.preferences ?? {},
  };

  return sha256(stableStringify(normalized));
}

async function getCachedPayload(cacheKey: string): Promise<GeneratedTripPayload | undefined> {
  if (!TRIP_CACHE_TABLE) return undefined;

  const response = await ddb.send(new GetCommand({
    TableName: TRIP_CACHE_TABLE,
    Key: { cacheKey },
  }));

  const item = response.Item as { result?: GeneratedTripPayload; expiresAt?: number } | undefined;
  if (!item?.result) return undefined;
  if (item.expiresAt && item.expiresAt <= Math.floor(Date.now() / 1000)) return undefined;

  return item.result;
}

async function putCachedPayload(cacheKey: string, result: GeneratedTripPayload): Promise<void> {
  if (!TRIP_CACHE_TABLE || CACHE_TTL_SECONDS <= 0) return;

  await ddb.send(new PutCommand({
    TableName: TRIP_CACHE_TABLE,
    Item: {
      cacheKey,
      result,
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS,
    },
  }));
}

async function generateTripPayload(apiKey: string, input: TripInput): Promise<GeneratedTripPayload> {
  const [logisticsResult, itineraryResult, restaurantsResult, tipsResult] = await Promise.allSettled([
    requestJsonSection<Record<string, unknown>>(apiKey, buildLogisticsPrompt(input)),
    requestJsonSection<Record<string, unknown>>(apiKey, buildItineraryPrompt(input)),
    requestJsonSection<Record<string, unknown>>(apiKey, buildRestaurantsPrompt(input)),
    requestJsonSection<Record<string, unknown>>(apiKey, buildTipsPrompt(input)),
  ]);

  const warnings: string[] = [];
  function sectionValue(result: PromiseSettledResult<Record<string, unknown>>, sectionName: string): Record<string, unknown> {
    if (result.status === 'fulfilled') return result.value;
    warnings.push(`${sectionName} generation timed out or failed; returned fallback data for that section.`);
    console.warn(`${sectionName} generation failed`, result.reason);
    return {};
  }

  const logistics = sectionValue(logisticsResult, 'Logistics');
  const itinerary = sectionValue(itineraryResult, 'Itinerary');
  const restaurants = sectionValue(restaurantsResult, 'Restaurants');
  const tips = sectionValue(tipsResult, 'Travel tips');

  const fallbackCostSummary = {
    flights: Math.round(input.budget * 0.3),
    hotels: Math.round(input.budget * 0.35),
    carRental: Math.round(input.budget * 0.12),
    foodEstimate: Math.round(input.budget * 0.15),
    activitiesEstimate: Math.round(input.budget * 0.08),
    total: input.budget,
  };

  return {
    departureIata: logistics.departureIata as string | undefined,
    destinationIata: logistics.destinationIata as string | undefined,
    flights: Array.isArray(logistics.flights) ? logistics.flights : [],
    hotels: Array.isArray(logistics.hotels) ? logistics.hotels : [],
    carRentals: Array.isArray(logistics.carRentals) ? logistics.carRentals : [],
    itinerary: Array.isArray(itinerary.itinerary) ? itinerary.itinerary : buildFallbackItinerary(input),
    restaurants: Array.isArray(restaurants.restaurants) ? restaurants.restaurants : buildFallbackRestaurants(input),
    travelTips: (tips.travelTips && typeof tips.travelTips === 'object') ? tips.travelTips as Record<string, unknown> : buildFallbackTravelTips(input),
    costSummary: (logistics.costSummary && typeof logistics.costSummary === 'object') ? logistics.costSummary as Record<string, unknown> : fallbackCostSummary,
    warnings,
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = JSON.parse(event.body ?? '{}') as Partial<TripInput>;
    const { departureCity, destinationCity, startDate, endDate, budget, travelers } = body;

    if (!departureCity || !destinationCity || !startDate || !endDate || !budget || !travelers) {
      return jsonResponse(400, { error: 'Missing required fields' });
    }

    const input: TripInput = {
      departureCity,
      destinationCity,
      startDate,
      endDate,
      budget: Number(budget),
      travelers: Number(travelers),
      preferences: body.preferences,
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'OpenAI API key not configured' });

    const cacheKey = await buildCacheKey(input);
    const cachedPayload = await getCachedPayload(cacheKey);
    const parsed = cachedPayload ?? await generateTripPayload(apiKey, input);
    if (!cachedPayload && (!parsed.warnings || parsed.warnings.length === 0)) await putCachedPayload(cacheKey, parsed);

    const tripId = randomUUID();
    const result = {
      tripId,
      status: 'COMPLETED',
      request: { departureCity, destinationCity, startDate, endDate, budget: input.budget, travelers: input.travelers,
        departureIata: parsed.departureIata, destinationIata: parsed.destinationIata },
      createdAt: new Date().toISOString(),
      flights:     parsed.flights     ?? [],
      hotels:      parsed.hotels      ?? [],
      carRentals:  parsed.carRentals  ?? [],
      itinerary:   parsed.itinerary   ?? [],
      restaurants: parsed.restaurants ?? [],
      travelTips:  parsed.travelTips  ?? {},
      costSummary: parsed.costSummary ?? {},
      warnings: parsed.warnings ?? [],
    };

    await ddb.send(new PutCommand({ TableName: RESULTS_TABLE, Item: result }));

    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
