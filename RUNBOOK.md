# GoNow Backend Service — Runbook

> AI agent reference. Last updated: 2026-05-20.

---

## Overview

Serverless TypeScript backend deployed on AWS. Exposes an HTTP API that generates AI-powered travel plans. The primary path is `POST /generate` (checks DynamoDB cache, calls Amadeus for real flight and hotel offers, opportunistically uses AI for itinerary/restaurants/tips, persists to DynamoDB, returns synchronously). A secondary Step Functions–based planner (`POST /trips`) exists for asynchronous progressive planning.

**AWS Account:** `766796016263`  
**Region:** `us-east-1`  
**CDK Stack:** `GoNowBackendStack`

---

## Product Architecture Goal

GoNow should save users more than 90% of trip-planning time by separating facts from intelligence:

- **Facts:** flight and hotel inventory must come from real provider APIs. The backend must not ask AI to invent flight numbers, hotel availability, or rental inventory.
- **Intelligence:** AI ranks, explains, bundles, and creates itinerary strategy from user preferences plus factual options.
- **Latency:** the first useful response should arrive in 2-5 seconds. Deeper AI enrichment can continue asynchronously.

Target user outcomes:
- Enter one form instead of opening 10-20 travel tabs.
- See route, lodging, car, itinerary, restaurant, cost, and reminder sections in one workspace.
- Understand why options fit the budget, arrival time, neighborhood, and travel style.
- Continue planning even if one provider is slow, because sections resolve independently.

### Target Infrastructure

```
Console SPA
  ├── POST /generate          # fast synchronous result for current wizard
  ├── POST /trips             # async progressive planning job
  └── GET /trips/{tripId}     # poll partial sections

API Gateway HTTP API
  ├── GenerateTripFunction
  │   ├── DynamoDB exact-request cache
  │   ├── TravelProviderGateway
  │   │   ├── Flights provider: Amadeus MVP
  │   │   ├── Hotels provider: Amadeus MVP
  │   │   └── Cars provider: not configured in MVP
  │   └── AI Planning Layer: itinerary, ranking, summaries, tips
  └── Step Functions TripPlannerStateMachine
      ├── PlanFlights
      ├── PlanHotels
      ├── PlanCars
      ├── PlanItinerary
      ├── PlanRestaurants
      └── FinalizeTrip

DynamoDB
  ├── TripsTable              # request + section statuses
  ├── TripResultsTable        # persisted full/partial trip results
  └── TripGenerationCacheTable# provider/AI cache entries
```

Provider integration rules:
- Use Amadeus for real-time flight offers and hotel offers in the MVP.
- If Amadeus credentials are missing, `/generate` returns HTTP 503 instead of fake data.
- Never display fabricated flight numbers, hotel names, or rental inventory as if confirmed.
- Car rental inventory is explicitly empty in the MVP until a real car provider is configured.
- Cache provider results with short TTLs: flights 5-15 min, hotels/cars 15-60 min, AI itinerary 24 hours if based on same factual options.

### Progressive UX Contract

The long-term `/trips` flow should return `tripId` immediately, then expose section-level statuses:

```json
{
  "status": "PLANNING",
  "sections": {
    "flights": "COMPLETED",
    "hotels": "PLANNING",
    "carRentals": "PLANNING",
    "itinerary": "PLANNING"
  }
}
```

The Console should show completed sections immediately instead of blocking the whole trip on the slowest provider or AI call.

## Repository Layout

```
TravelPlanService/
├── shared/src/          # Shared TypeScript types, constants, schemas
├── service/src/
│   ├── handlers/        # Lambda entry points (one file = one function)
│   ├── domain/          # Rule-based recommenders (flights, hotels, etc.)
│   ├── repositories/    # DynamoDB access (tripsRepository.ts)
│   ├── clients/         # AWS SDK singletons: dynamo.ts, stepFunctions.ts
│   └── utils/           # response.ts, date.ts, deepLinks.ts
├── infra/src/
│   ├── app.ts           # CDK app entry (loads dist/app.js via cdk.json)
│   └── stacks/gonow-backend-stack.ts   # All AWS resources
├── tsconfig.shared.json
├── tsconfig.service.json
├── tsconfig.infra.json
└── package.json         # Root npm workspace; build order: shared → service → infra
```

---

## Infrastructure

All resources live in `infra/src/stacks/gonow-backend-stack.ts`.

### API Gateway (HTTP API v2)
Name: `gonow-api`

| Method | Path | Lambda | Auth |
|--------|------|--------|------|
| POST | `/trips` | CreateTripFunction | None |
| GET | `/trips/{tripId}` | GetTripFunction | None |
| POST | `/generate` | GenerateTripFunction | None |
| GET | `/users/me` | GetUserProfileFunction | Cognito JWT |
| PUT | `/users/me/preferences` | PutUserPreferencesFunction | Cognito JWT |

### Lambda Functions
All use **Node.js 20.x**. Code loaded from `../service/dist` at deploy time.

| Function | Handler file | Timeout | Key env vars |
|----------|-------------|---------|--------------|
| GenerateTripFunction | `handlers/generateTrip.ts` | 60 s | `RESULTS_TABLE_NAME`, `TRIP_CACHE_TABLE_NAME`, `OPENAI_API_KEY`, `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `OPENAI_MODEL`, `OPENAI_SECTION_TIMEOUT_MS` |
| CreateTripFunction | `handlers/createTrip.ts` | 15 s | `TRIPS_TABLE_NAME`, `RESULTS_TABLE_NAME`, `TRIP_PLANNER_STATE_MACHINE_ARN` |
| GetTripFunction | `handlers/getTrip.ts` | 10 s | `TRIPS_TABLE_NAME`, `RESULTS_TABLE_NAME` |
| GetUserProfileFunction | `handlers/getUserProfile.ts` | 10 s | `USERS_TABLE_NAME`, `USER_POOL_ID` |
| PutUserPreferencesFunction | `handlers/putUserPreferences.ts` | 10 s | `USERS_TABLE_NAME`, `USER_POOL_ID` |
| PlanFlights/Hotels/Car/Itinerary/Restaurants/TravelTips | `handlers/plan*.ts` | 15 s | `TRIPS_TABLE_NAME`, `RESULTS_TABLE_NAME` |
| FinalizeTripFunction | `handlers/finalizeTrip.ts` | 15 s | `TRIPS_TABLE_NAME`, `RESULTS_TABLE_NAME` |
| MarkTripFailedFunction | `handlers/markTripFailed.ts` | 15 s | `TRIPS_TABLE_NAME`, `RESULTS_TABLE_NAME` |

### DynamoDB Tables
| Table (CDK ID) | PK | SK | Purpose |
|----------------|----|----|---------|
| TripsTable | `tripId` (S) | — | Trip input + status (rule-based flow) |
| TripResultsTable | `tripId` (S) | — | Generated results (both flows) |
| TripGenerationCacheTable | `cacheKey` (S) | — | Exact-request cache for `/generate` OpenAI payloads |
| UsersTable | `PK` (S) | `SK` (S) | Single-table: profiles + preferences |

`UsersTable` has GSI `email-index` (PK: `email`, KEYS_ONLY) for email lookups.  
`TripGenerationCacheTable` uses DynamoDB TTL on `expiresAt`; default cache lifetime is 24 hours via `TRIP_CACHE_TTL_SECONDS=86400`.  
Trip/cache tables: `PAY_PER_REQUEST`, `RemovalPolicy.DESTROY` — **change to RETAIN before production where needed**. `UsersTable` already uses `RETAIN`.

### Step Functions (rule-based flow)
State machine: `TripPlannerStateMachine`, timeout 5 min, logs to CloudWatch (1-week retention).

Parallel execution:
```
Plan Trip Sections In Parallel
├── PlanFlights
├── PlanHotels
├── PlanCarRentals
├── PlanItinerary
├── PlanRestaurants
└── PlanTravelTips
→ FinalizeTrip
```
Any branch or finalize failure routes to `MarkTripFailed` via `.addCatch`.

### Cognito
- User Pool `GoNowUserPool`: self sign-up, email sign-in, min password 8 chars
- Web client `GoNowWebClient`: no secret, `USER_PASSWORD_AUTH` + `USER_SRP_AUTH`
- JWT authorizer on `/users/me` and `/users/me/preferences`

---

## Primary Data Flow — AI Path

`POST /generate` → `GenerateTripFunction`:
1. Validates required fields: `departureCity`, `destinationCity`, `startDate`, `endDate`, `budget`, `travelers`
2. Normalizes the trip request and hashes it into a deterministic cache key
3. Reads `TripGenerationCacheTable`; on hit, reuses the cached trip payload without calling OpenAI
4. On cache miss, calls Amadeus for real provider data:
   - flights
   - hotels
   - cost summary from returned offers
5. Runs AI prompts in parallel with short per-section deadlines:
   - itinerary
   - restaurants
   - travel tips
6. Any AI section that misses the deadline is returned empty with a warning, not locally fabricated
7. Combines the payloads, generates a fresh `tripId`, writes to `TripResultsTable`
8. Returns full result synchronously — no polling required

### Latency Strategy
- **Target response:** 2-5 seconds for `/generate`, including first-time cache misses.
- **Cache first:** identical trip searches within the TTL avoid OpenAI latency and cost.
- **Truthful logistics:** flights and hotels come from Amadeus; AI is not used as an inventory database.
- **Strict provider mode:** no provider credentials means no generated logistics response.
- **Fast AI:** itinerary/tips/restaurants are attempted with short deadlines; empty sections are allowed rather than fabricated.
- **Parallel model calls:** OpenAI enriches itinerary/tips/restaurants opportunistically; it is not allowed to hold the request open near API Gateway limits.
- **Smaller JSON surfaces:** each prompt returns a narrower schema, lowering parse failures and retry pressure.
- **Fresh trip ids:** cached payloads are reused, but every request still gets a unique persisted result.
- **MVP limitation:** real-time car rental inventory is not implemented yet.

Tuneables:
- `OPENAI_MODEL` defaults to `gpt-4o-mini`
- `OPENAI_SECTION_TIMEOUT_MS` defaults to `1000`
- `AMADEUS_BASE_URL` defaults to `https://test.api.amadeus.com`; use production only after Amadeus production approval
- `AMADEUS_REQUEST_TIMEOUT_MS` defaults to `4500`
- `TRIP_CACHE_TTL_SECONDS` defaults to `86400`; set to `0` to disable writes while leaving reads harmless if no table is configured

**Critical:** `OPENAI_API_KEY`, `AMADEUS_CLIENT_ID`, and `AMADEUS_CLIENT_SECRET` must be exported in the shell before `cdk deploy`. They are injected as Lambda env vars at deploy time. If OpenAI is missing, the function returns HTTP 500; if Amadeus is missing, `/generate` returns HTTP 503.

---

## Build & Deploy

### Prerequisites
- Node.js ≥ 18, npm ≥ 7
- AWS CLI configured for account `766796016263`
- `OPENAI_API_KEY`, `AMADEUS_CLIENT_ID`, and `AMADEUS_CLIENT_SECRET` exported in shell

### Build
```bash
# From TravelPlanService root
npm install
npm run build   # runs build:shared → build:service → build:infra
```

If workspace issues occur, build manually:
```bash
cd shared && npm install && npm run build
cd ../service && npm install && npm run build
cd ../infra && npm install && npm run build
```

### First-time CDK bootstrap (once per account/region)
```bash
cd infra
npx cdk bootstrap aws://766796016263/us-east-1
```

### Deploy
```bash
export OPENAI_API_KEY=sk-...
export AMADEUS_CLIENT_ID=...
export AMADEUS_CLIENT_SECRET=...
npx cdk deploy GoNowBackendStack --require-approval never
```

CDK outputs after deploy:
- `HttpApiUrl` — base URL for all API calls (set this in Console's `.env.local`)
- `TripsTableName`, `ResultsTableName`, `UsersTableName`
- `TripPlannerStateMachineArn`
- `UserPoolId`, `UserPoolClientId`

---

## API Reference

### POST /generate
```json
// Request
{ "departureCity": "San Francisco", "destinationCity": "Tokyo",
  "startDate": "2026-07-01", "endDate": "2026-07-10", "budget": 5000, "travelers": 2 }

// Response: full TripResult with flights, hotels, carRentals, itinerary,
//           restaurants, travelTips, costSummary, tripId
```

### POST /trips (legacy rule-based)
Returns `{ tripId }`. Poll `GET /trips/{tripId}` for status/result.

### GET /trips/{tripId}
Returns trip status and result from DynamoDB.

### GET /users/me *(Cognito JWT required)*
Returns user profile. DynamoDB key: `PK=USER#{cognitoSub}`, `SK=PROFILE`.

### PUT /users/me/preferences *(Cognito JWT required)*
Upserts preferences. DynamoDB key: `PK=USER#{cognitoSub}`, `SK=PREFERENCES`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `POST /generate` → 500 "OpenAI API key not configured" | `OPENAI_API_KEY` missing at deploy time | Re-deploy with key exported |
| `POST /generate` → 503 "Real travel provider is not configured" | `AMADEUS_CLIENT_ID` or `AMADEUS_CLIENT_SECRET` missing at deploy time | Re-deploy with Amadeus credentials exported |
| Repeat `/generate` calls still hit OpenAI | Cache table missing, TTL expired, or request fields differ after normalization | Confirm `TRIP_CACHE_TABLE_NAME`, inspect `TripGenerationCacheTable`, compare request payloads |
| CDK deploy fails with auth error | AWS CLI not configured | `aws configure` or set `AWS_PROFILE` |
| `No workspaces found` npm error | Running npm inside a sub-package | Run from `TravelPlanService` root |
| Lambda "handler not found" | `service/dist` stale or missing | `npm run build` from root, then redeploy |
| Step Functions execution stuck | Planner Lambda timeout/error | Check CloudWatch log group `TripPlannerLogs` |
| `cdk bootstrap` required error | First deploy to this account/region | Run bootstrap command above |

---

## Known Limitations

- `OPENAI_API_KEY` stored as plain Lambda env var — move to Secrets Manager for production
- No WAF, custom domain, or CloudWatch alarms configured
- `/generate` and `/trips` have no authentication
- `/generate` cache is exact-match only; nearby dates/cities do not share cached payloads
- Single destination city only
