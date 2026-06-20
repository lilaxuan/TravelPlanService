interface ProviderTripInput {
  departureCity: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  budget: number;
  travelers: number;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface AmadeusLocationResponse {
  data?: Array<{
    iataCode?: string;
    subType?: string;
    name?: string;
  }>;
}

interface AmadeusFlightOffer {
  itineraries?: Array<{
    duration?: string;
    segments?: Array<{
      carrierCode?: string;
      number?: string;
      departure?: { iataCode?: string; at?: string };
      arrival?: { iataCode?: string; at?: string };
    }>;
  }>;
  price?: {
    grandTotal?: string;
    total?: string;
    currency?: string;
  };
}

interface AmadeusFlightResponse {
  data?: AmadeusFlightOffer[];
  dictionaries?: {
    carriers?: Record<string, string>;
  };
}

interface AmadeusHotelListResponse {
  data?: Array<{
    hotelId?: string;
    name?: string;
  }>;
}

interface AmadeusHotelOffersResponse {
  data?: Array<{
    hotel?: {
      name?: string;
      rating?: string;
      address?: {
        cityName?: string;
        lines?: string[];
      };
    };
    offers?: Array<{
      price?: {
        total?: string;
        currency?: string;
      };
      room?: {
        description?: { text?: string };
        typeEstimated?: { category?: string };
      };
      policies?: {
        cancellations?: Array<{ description?: { text?: string } }>;
      };
    }>;
  }>;
}

export class ProviderConfigurationError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

export interface ProviderLogistics {
  departureIata: string;
  destinationIata: string;
  flights: Array<Record<string, unknown>>;
  hotels: Array<Record<string, unknown>>;
  carRentals: Array<Record<string, unknown>>;
  costSummary: Record<string, unknown>;
  warnings: string[];
}

let tokenCache: TokenCache | undefined;

function amadeusBaseUrl(): string {
  return process.env.AMADEUS_BASE_URL ?? 'https://test.api.amadeus.com';
}

function requestTimeoutMs(): number {
  return Number(process.env.AMADEUS_REQUEST_TIMEOUT_MS ?? 4500);
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ProviderConfigurationError('Real travel provider is not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET.');
  }

  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.accessToken;

  const { clientId, clientSecret } = getCredentials();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${amadeusBaseUrl()}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`Amadeus token request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error('Amadeus token response did not include access_token');

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + ((payload.expires_in ?? 1_500) * 1000),
  };

  return payload.access_token;
}

async function amadeusGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(path, amadeusBaseUrl());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`Amadeus request failed (${response.status}) for ${path}: ${(await response.text()).slice(0, 500)}`);
  }

  return response.json() as Promise<T>;
}

function toMoney(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function formatDateTime(value: string | undefined): string {
  if (!value) return 'Unavailable';
  return value.replace('T', ' ');
}

function formatDuration(duration: string | undefined): string {
  if (!duration) return 'Unavailable';
  const hours = duration.match(/(\d+)H/)?.[1];
  const minutes = duration.match(/(\d+)M/)?.[1];
  return [
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
  ].filter(Boolean).join(' ') || duration;
}

function tripLengthInNights(startDate: string, endDate: string): number {
  return Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000));
}

async function resolveIataCode(keyword: string): Promise<string> {
  const response = await amadeusGet<AmadeusLocationResponse>('/v1/reference-data/locations', {
    subType: 'CITY,AIRPORT',
    keyword,
    'page[limit]': 5,
  });

  const city = response.data?.find((location) => location.subType === 'CITY' && location.iataCode);
  const airport = response.data?.find((location) => location.subType === 'AIRPORT' && location.iataCode);
  const location = city ?? airport;

  if (!location?.iataCode) throw new Error(`Could not resolve IATA code for "${keyword}"`);
  return location.iataCode;
}

async function searchFlights(input: ProviderTripInput, origin: string, destination: string): Promise<Array<Record<string, unknown>>> {
  const response = await amadeusGet<AmadeusFlightResponse>('/v2/shopping/flight-offers', {
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: input.startDate,
    returnDate: input.endDate,
    adults: input.travelers,
    currencyCode: 'USD',
    max: 5,
  });

  return (response.data ?? []).slice(0, 3).map((offer, index) => {
    const outbound = offer.itineraries?.[0];
    const segments = outbound?.segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    const carrierCode = first?.carrierCode ?? 'XX';
    const airline = response.dictionaries?.carriers?.[carrierCode] ?? carrierCode;
    const flightNumbers = segments
      .map((segment) => `${segment.carrierCode ?? ''}${segment.number ?? ''}`.trim())
      .filter(Boolean)
      .join(' / ');

    return {
      airline,
      flightNumber: flightNumbers || `Offer ${index + 1}`,
      departure: `${first?.departure?.iataCode ?? origin} ${formatDateTime(first?.departure?.at)}`,
      arrival: `${last?.arrival?.iataCode ?? destination} ${formatDateTime(last?.arrival?.at)}`,
      estimatedPrice: toMoney(offer.price?.grandTotal ?? offer.price?.total) ?? 0,
      duration: formatDuration(outbound?.duration),
      stops: segments.length <= 1 ? 'Nonstop' : `${segments.length - 1} stop${segments.length - 1 === 1 ? '' : 's'}`,
      provider: 'Amadeus',
      isLiveSearch: false,
      priceLabel: offer.price?.currency ?? 'USD',
    };
  });
}

async function searchHotels(input: ProviderTripInput, destination: string): Promise<Array<Record<string, unknown>>> {
  const hotels = await amadeusGet<AmadeusHotelListResponse>('/v1/reference-data/locations/hotels/by-city', {
    cityCode: destination,
    radius: 20,
    radiusUnit: 'KM',
    hotelSource: 'ALL',
  });

  const hotelIds = (hotels.data ?? [])
    .map((hotel) => hotel.hotelId)
    .filter((hotelId): hotelId is string => Boolean(hotelId))
    .slice(0, 20);

  if (hotelIds.length === 0) return [];

  const offers = await amadeusGet<AmadeusHotelOffersResponse>('/v3/shopping/hotel-offers', {
    hotelIds: hotelIds.join(','),
    adults: input.travelers,
    checkInDate: input.startDate,
    checkOutDate: input.endDate,
    currency: 'USD',
    bestRateOnly: 'true',
  });

  const nights = tripLengthInNights(input.startDate, input.endDate);
  return (offers.data ?? []).slice(0, 3).map((hotelOffer) => {
    const offer = hotelOffer.offers?.[0];
    const total = toMoney(offer?.price?.total) ?? 0;

    return {
      name: hotelOffer.hotel?.name ?? 'Hotel offer',
      area: hotelOffer.hotel?.address?.cityName ?? input.destinationCity,
      estimatedNightlyPrice: total ? Math.round(total / nights) : 0,
      totalEstimatedPrice: total,
      starRating: Number(hotelOffer.hotel?.rating ?? 0) || 0,
      highlights: offer?.room?.description?.text ?? offer?.room?.typeEstimated?.category ?? 'Live hotel offer from Amadeus.',
      provider: 'Amadeus',
      isLiveSearch: false,
      priceLabel: offer?.price?.currency ?? 'USD',
    };
  });
}

function estimateCosts(
  input: ProviderTripInput,
  flights: Array<Record<string, unknown>>,
  hotels: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const flightPrice = Number(flights[0]?.estimatedPrice ?? 0);
  const hotelTotal = Number(hotels[0]?.totalEstimatedPrice ?? 0);
  const foodEstimate = Math.round(input.budget * 0.16);
  const activitiesEstimate = Math.round(input.budget * 0.1);

  return {
    flights: flightPrice,
    hotels: hotelTotal,
    carRental: 0,
    foodEstimate,
    activitiesEstimate,
    total: flightPrice + hotelTotal + foodEstimate + activitiesEstimate,
  };
}

export async function getAmadeusLogistics(input: ProviderTripInput): Promise<ProviderLogistics> {
  const [departureIata, destinationIata] = await Promise.all([
    resolveIataCode(input.departureCity),
    resolveIataCode(input.destinationCity),
  ]);

  const warnings: string[] = [];
  const [flightResult, hotelResult] = await Promise.allSettled([
    searchFlights(input, departureIata, destinationIata),
    searchHotels(input, destinationIata),
  ]);

  const flights = flightResult.status === 'fulfilled' ? flightResult.value : [];
  const hotels = hotelResult.status === 'fulfilled' ? hotelResult.value : [];

  if (flightResult.status === 'rejected') warnings.push(`Amadeus flight search failed: ${flightResult.reason instanceof Error ? flightResult.reason.message : 'Unknown error'}`);
  if (hotelResult.status === 'rejected') warnings.push(`Amadeus hotel search failed: ${hotelResult.reason instanceof Error ? hotelResult.reason.message : 'Unknown error'}`);
  if (flights.length === 0) warnings.push('No real-time flight offers returned by Amadeus for this request.');
  if (hotels.length === 0) warnings.push('No real-time hotel offers returned by Amadeus for this request.');
  warnings.push('Real-time car rental provider is not configured for this MVP.');

  return {
    departureIata,
    destinationIata,
    flights,
    hotels,
    carRentals: [],
    costSummary: estimateCosts(input, flights, hotels),
    warnings,
  };
}
