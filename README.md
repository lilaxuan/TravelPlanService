# 📦 GoNow Backend Service

GoNow Backend is a serverless TypeScript-based service that powers the travel planning platform. It provides APIs, orchestration workflows, and data storage for generating end-to-end trip plans.

---

## 🧱 Architecture Overview

This service is built using:

- TypeScript
- AWS Lambda
- AWS Step Functions
- Amazon DynamoDB
- AWS CDK (Infrastructure as Code)

The system orchestrates multiple recommendation services (flights, hotels, itinerary, etc.) into a single trip plan.

---

## 📁 Project Structure

```
gonow-backend/
├── packages/
│   ├── shared/        # Shared types and utilities
│   ├── service/       # Lambda handlers (business logic)
│   └── infra/         # CDK stacks (infrastructure)
├── package.json       # Root workspace config
└── README.md
```

---

## ⚙️ Prerequisites

- Node.js >= 18
- npm >= 7 (required for workspaces)
- AWS CLI configured
- AWS account access: 766796016263

---

## 🚀 Getting Started

### 1. Install dependencies (from root)

```bash
npm install
```

### 2. Build all packages

```bash
npm run build
```

If workspace issues occur, build manually:

```bash
cd packages/shared && npm install && npm run build
cd ../service && npm install && npm run build
cd ../infra && npm install && npm run build
```

---

## 🧪 Run Locally (Optional)

You can invoke Lambda handlers locally using:
- ts-node
- simple scripts
- AWS SAM CLI (optional)

---

## ☁️ Deploy to AWS

### 1. Bootstrap CDK (only once per account)

```bash
cd packages/infra
npx cdk bootstrap aws://766796016263/us-east-1
```

### 2. Deploy stack

```bash
npx cdk deploy
```

This will create:
- API Gateway (HTTP API)
- Lambda functions
- Step Functions state machine
- DynamoDB tables
- CloudWatch log groups

---

## 🔌 API Endpoints

### Create Trip

POST /trips

### Get Trip Status / Result

GET /trips/{tripId}

---

## 🔄 Workflow (Step Functions)

1. Create trip record  
2. Run recommendation services:
   - Flights  
   - Hotels  
   - Car rentals  
   - Itinerary  
   - Restaurants  
   - Travel tips  
3. Aggregate results  
4. Store final trip plan  
5. Return results  

---

## 🧠 Core Lambda Functions

| Function              | Purpose |
|----------------------|--------|
| createTrip           | Entry API to start planning |
| getTrip              | Fetch trip status/results |
| planFlights          | Generate flight options |
| planHotels           | Generate hotel options |
| planCarRentals       | Generate transport options |
| planItinerary        | Generate daily plan |
| planRestaurants      | Recommend food |
| planTravelTips       | Provide guidance |
| finalizeTrip         | Aggregate results |
| markTripFailed       | Handle failures |

---

## 🗄️ Data Model

### DynamoDB Tables

- Trips — stores trip input and status  
- TripResults — stores generated results  
- DestinationMetadata — optional static data  

---

## ⚠️ Known Limitations

- Single destination city only  
- No real-time booking APIs (redirect links only)  
- Basic rule-based recommendation logic  
- No authentication  
- Sequential workflow (simplified for stability)  

---

## 🛣️ Future Improvements

- Parallel Step Functions execution  
- AI-based itinerary generation  
- Real API integrations  
- User accounts (Cognito)  
- Price alerts  
- Multi-city trip planning  

---

## 🧩 Troubleshooting

### Workspace error

No workspaces found: --workspace=@gonow/shared

Fix:
- Run commands from repo root
- Ensure npm >= 7

---

### CDK deploy fails

- Check AWS credentials
- Ensure correct account: 766796016263
- Run cdk bootstrap first

---

## 📌 Notes

- Designed for fast iteration + scalability  
- Keep services modular  
- Focus on shipping P0 before adding complexity  
