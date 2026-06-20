import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ddb } from '../clients/dynamo.js';
import { jsonResponse } from '../utils/response.js';

const RESULTS_TABLE = process.env.RESULTS_TABLE_NAME!;
const TRIP_CACHE_TABLE = process.env.TRIP_CACHE_TABLE_NAME;
const CACHE_TTL_SECONDS = Number(process.env.TRIP_CACHE_TTL_SECONDS ?? 86_400);
const OPENAI_SECTION_TIMEOUT_MS = Number(process.env.OPENAI_SECTION_TIMEOUT_MS ?? 25_000);
const PROMPT_VERSION = 'itinerary-map-v3';

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

function cityCode(city: string): string {
  const letters = city.replace(/[^a-z]/gi, '').toUpperCase();
  return (letters.slice(0, 3) || 'AIR').padEnd(3, 'X');
}

function buildStaticLogistics(input: TripInput): Pick<
  GeneratedTripPayload,
  'departureIata' | 'destinationIata' | 'flights' | 'hotels' | 'carRentals' | 'costSummary'
> {
  const nights = tripLengthInNights(input.startDate, input.endDate);
  const departureIata = cityCode(input.departureCity);
  const destinationIata = cityCode(input.destinationCity);
  const flightBase = Math.max(180, Math.round((input.budget * 0.18) / Math.max(1, input.travelers)));
  const nightlyBase = Math.max(120, Math.round((input.budget * 0.32) / nights));
  const carBase = Math.max(180, nights * 58);
  const flightTotal = flightBase * input.travelers;
  const hotelTotal = nightlyBase * nights;
  const foodEstimate = Math.round(70 * input.travelers * nights);
  const activitiesEstimate = Math.round(45 * input.travelers * Math.max(1, nights - 1));

  return {
    departureIata,
    destinationIata,
    flights: [
      {
        airline: 'Flexible fare search',
        flightNumber: `${departureIata}-${destinationIata}`,
        departure: `${departureIata} morning`,
        arrival: `${destinationIata} afternoon`,
        estimatedPrice: flightBase,
        duration: 'Search live times',
        stops: 'Best available',
        isLiveSearch: true,
        priceLabel: 'Estimate only',
        recommendationReason: 'Static planning option; open a provider to confirm live flight inventory.',
      },
      {
        airline: 'Budget fare search',
        flightNumber: `${departureIata}-${destinationIata}-VALUE`,
        departure: `${departureIata} flexible`,
        arrival: `${destinationIata} flexible`,
        estimatedPrice: Math.max(120, flightBase - 45),
        duration: 'Search live times',
        stops: 'Lowest fare focus',
        isLiveSearch: true,
        priceLabel: 'Estimate only',
        recommendationReason: 'Static planning option for price-sensitive searches.',
      },
    ],
    hotels: [
      {
        name: `${input.destinationCity} Central Hotel Search`,
        area: 'Central / transit-friendly area',
        estimatedNightlyPrice: nightlyBase,
        totalEstimatedPrice: hotelTotal,
        starRating: 4,
        highlights: 'Recommended search area for first-time visitors, transit access, and easy dinner plans.',
        isLiveSearch: true,
        priceLabel: 'Estimate only',
      },
      {
        name: `${input.destinationCity} Neighborhood Stay Search`,
        area: 'Local neighborhood option',
        estimatedNightlyPrice: Math.max(95, nightlyBase - 35),
        totalEstimatedPrice: Math.max(95, nightlyBase - 35) * nights,
        starRating: 3,
        highlights: 'Recommended search area for better value and a more local base.',
        isLiveSearch: true,
        priceLabel: 'Estimate only',
      },
    ],
    carRentals: [
      {
        provider: 'Airport rental search',
        estimatedTotalPrice: carBase,
        pickupLocation: `${input.destinationCity} airport`,
        bookingUrl: `https://www.expedia.com/Cars?pickup=${encodeURIComponent(input.destinationCity)}&startDate=${input.startDate}&endDate=${input.endDate}`,
        isLiveSearch: true,
        priceLabel: 'Estimate only',
      },
      {
        provider: 'City pickup rental search',
        estimatedTotalPrice: Math.max(160, carBase - 40),
        pickupLocation: `${input.destinationCity} city center`,
        bookingUrl: `https://www.kayak.com/cars/${encodeURIComponent(input.destinationCity)}/${input.startDate}/${input.endDate}`,
        isLiveSearch: true,
        priceLabel: 'Estimate only',
      },
    ],
    costSummary: {
      flights: flightTotal,
      hotels: hotelTotal,
      carRental: carBase,
      foodEstimate,
      activitiesEstimate,
      total: flightTotal + hotelTotal + carBase + foodEstimate + activitiesEstimate,
    },
  };
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

function buildItineraryPrompt(input: TripInput): string {
  const nights = tripLengthInNights(input.startDate, input.endDate);

  return `${baseTripContext(input)}

Return JSON matching:
{
  "itinerary": [{ "dayNumber": number, "theme": string, "activities": [{ "time": string, "name": string, "type": string, "notes": string | undefined, "transportFromPrevious": string | undefined, "lat": number, "lng": number }] }]
}
Requirements:
- Do not generate flight, hotel, car rental, price, or booking inventory. The service provides those static planning options separately.
- Build a detailed day-by-day itinerary for every calendar day between ${input.startDate} and ${input.endDate}. Use dayNumber 1 through ${nights}.
- Each day must include 4-6 chronological activities with realistic times from morning through evening.
- Each activity must be a real, mappable place in or near ${input.destinationCity}. Use specific place names, not generic labels like "museum", "downtown walk", or "local lunch".
- Every activity must include numeric "lat" and "lng" coordinates that Google Maps can plot. Do not omit coordinates. Use the best-known entrance/center coordinates for the place.
- Cluster each day geographically so the map route is practical instead of jumping across the city.
- "transportFromPrevious" must describe the route from the previous activity to this activity using this format: "From [previous place]: [walk/drive/transit] about [minutes] min, [miles] mi / [kilometers] km." Use both miles and kilometers for every transition.
- For the first activity of each day, "transportFromPrevious" must describe the route from the recommended hotel/base area using the same format, including estimated drive or walk time, miles, and kilometers.
- Choose walk for short urban transfers, transit when it is practical, and drive/rideshare for longer transfers. Keep the estimate realistic for normal traffic and walking speed.
- "notes" must explain why the stop fits the user's destination, dates, budget, and traveler count, plus any reservation/ticket timing advice.
- Use activity "type" values such as "attraction", "restaurant", "culture", "nature", "shopping", "viewpoint", "transport", or "free_time".
- Include meals as activities when they are part of the day's flow, and make those meal stops match the restaurants list when sensible.
- Keep the pacing realistic for ${input.travelers} traveler${input.travelers === 1 ? '' : 's'} and leave buffers between major stops.`;
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

async function requestJsonSection<T extends Record<string, unknown>>(apiKey: string, prompt: string, maxTokens = 1800): Promise<T> {
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
      max_tokens: maxTokens,
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
    promptVersion: PROMPT_VERSION,
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
  const staticLogistics = buildStaticLogistics(input);
  const [itineraryResult, restaurantsResult, tipsResult] = await Promise.allSettled([
    requestJsonSection<Record<string, unknown>>(apiKey, buildItineraryPrompt(input), 5000),
    requestJsonSection<Record<string, unknown>>(apiKey, buildRestaurantsPrompt(input)),
    requestJsonSection<Record<string, unknown>>(apiKey, buildTipsPrompt(input)),
  ]);

  const warnings: string[] = [];
  function sectionValue(result: PromiseSettledResult<Record<string, unknown>>, sectionName: string): Record<string, unknown> {
    if (result.status === 'fulfilled') return result.value;
    warnings.push(`${sectionName} generation timed out or failed; no generated ${sectionName.toLowerCase()} was returned.`);
    console.warn(`${sectionName} generation failed`, result.reason);
    return {};
  }

  const itinerary = sectionValue(itineraryResult, 'Itinerary');
  const restaurants = sectionValue(restaurantsResult, 'Restaurants');
  const tips = sectionValue(tipsResult, 'Travel tips');

  return {
    departureIata: staticLogistics.departureIata,
    destinationIata: staticLogistics.destinationIata,
    flights: staticLogistics.flights,
    hotels: staticLogistics.hotels,
    carRentals: staticLogistics.carRentals,
    itinerary: Array.isArray(itinerary.itinerary) ? itinerary.itinerary : [],
    restaurants: Array.isArray(restaurants.restaurants) ? restaurants.restaurants : [],
    travelTips: (tips.travelTips && typeof tips.travelTips === 'object') ? tips.travelTips as Record<string, unknown> : {},
    costSummary: staticLogistics.costSummary,
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
