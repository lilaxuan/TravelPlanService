"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoNowBackendStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigwv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigwIntegrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
class GoNowBackendStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const tripsTable = new dynamodb.Table(this, 'TripsTable', {
            partitionKey: { name: 'tripId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY
        });
        const resultsTable = new dynamodb.Table(this, 'TripResultsTable', {
            partitionKey: { name: 'tripId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY
        });
        const nodeRuntime = lambda.Runtime.NODEJS_20_X;
        const baseEnv = {
            TRIPS_TABLE_NAME: tripsTable.tableName,
            RESULTS_TABLE_NAME: resultsTable.tableName,
            TRIP_PLANNER_STATE_MACHINE_ARN: 'PLACEHOLDER_REPLACED_AFTER_CREATION'
        };
        const serviceCodePath = '../service/dist';
        const createTripFn = new lambda.Function(this, 'CreateTripFunction', {
            runtime: nodeRuntime,
            handler: 'handlers/createTrip.handler',
            code: lambda.Code.fromAsset(serviceCodePath),
            timeout: aws_cdk_lib_1.Duration.seconds(15),
            environment: baseEnv
        });
        const getTripFn = new lambda.Function(this, 'GetTripFunction', {
            runtime: nodeRuntime,
            handler: 'handlers/getTrip.handler',
            code: lambda.Code.fromAsset(serviceCodePath),
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            environment: baseEnv
        });
        const flightFn = this.createPlannerFunction('PlanFlightsFunction', 'handlers/planFlights.handler', serviceCodePath, baseEnv);
        const hotelFn = this.createPlannerFunction('PlanHotelsFunction', 'handlers/planHotels.handler', serviceCodePath, baseEnv);
        const carFn = this.createPlannerFunction('PlanCarRentalsFunction', 'handlers/planCarRentals.handler', serviceCodePath, baseEnv);
        const itineraryFn = this.createPlannerFunction('PlanItineraryFunction', 'handlers/planItinerary.handler', serviceCodePath, baseEnv);
        const restaurantFn = this.createPlannerFunction('PlanRestaurantsFunction', 'handlers/planRestaurants.handler', serviceCodePath, baseEnv);
        const tipsFn = this.createPlannerFunction('PlanTravelTipsFunction', 'handlers/planTravelTips.handler', serviceCodePath, baseEnv);
        const finalizeFn = this.createPlannerFunction('FinalizeTripFunction', 'handlers/finalizeTrip.handler', serviceCodePath, baseEnv);
        const failFn = this.createPlannerFunction('MarkTripFailedFunction', 'handlers/markTripFailed.handler', serviceCodePath, baseEnv);
        tripsTable.grantReadWriteData(createTripFn);
        tripsTable.grantReadData(getTripFn);
        tripsTable.grantReadWriteData(finalizeFn);
        tripsTable.grantReadWriteData(failFn);
        resultsTable.grantReadData(getTripFn);
        resultsTable.grantReadWriteData(finalizeFn);
        const commonPayload = {
            departureCity: sfn.JsonPath.stringAt('$.departureCity'),
            destinationCity: sfn.JsonPath.stringAt('$.destinationCity'),
            startDate: sfn.JsonPath.stringAt('$.startDate'),
            endDate: sfn.JsonPath.stringAt('$.endDate'),
            budget: sfn.JsonPath.numberAt('$.budget'),
            travelers: sfn.JsonPath.numberAt('$.travelers'),
            preferences: sfn.JsonPath.objectAt('$.preferences')
        };
        const planFlights = new tasks.LambdaInvoke(this, 'Plan Flights', {
            lambdaFunction: flightFn,
            payload: sfn.TaskInput.fromObject(commonPayload),
            resultPath: '$.flightPlan'
        });
        const planHotels = new tasks.LambdaInvoke(this, 'Plan Hotels', {
            lambdaFunction: hotelFn,
            payload: sfn.TaskInput.fromObject(commonPayload),
            resultPath: '$.hotelPlan'
        });
        const planCar = new tasks.LambdaInvoke(this, 'Plan Car Rentals', {
            lambdaFunction: carFn,
            payload: sfn.TaskInput.fromObject(commonPayload),
            resultPath: '$.carPlan'
        });
        const planItinerary = new tasks.LambdaInvoke(this, 'Plan Itinerary', {
            lambdaFunction: itineraryFn,
            payload: sfn.TaskInput.fromObject(commonPayload),
            resultPath: '$.itineraryPlan'
        });
        const planRestaurants = new tasks.LambdaInvoke(this, 'Plan Restaurants', {
            lambdaFunction: restaurantFn,
            payload: sfn.TaskInput.fromObject(commonPayload),
            resultPath: '$.restaurantPlan'
        });
        const planTips = new tasks.LambdaInvoke(this, 'Plan Travel Tips', {
            lambdaFunction: tipsFn,
            payload: sfn.TaskInput.fromObject(commonPayload),
            resultPath: '$.tipsPlan'
        });
        const finalize = new tasks.LambdaInvoke(this, 'Finalize Trip', {
            lambdaFunction: finalizeFn,
            payload: sfn.TaskInput.fromObject({
                tripId: sfn.JsonPath.stringAt('$.tripId'),
                departureCity: sfn.JsonPath.stringAt('$.departureCity'),
                destinationCity: sfn.JsonPath.stringAt('$.destinationCity'),
                startDate: sfn.JsonPath.stringAt('$.startDate'),
                endDate: sfn.JsonPath.stringAt('$.endDate'),
                budget: sfn.JsonPath.numberAt('$.budget'),
                travelers: sfn.JsonPath.numberAt('$.travelers'),
                preferences: sfn.JsonPath.objectAt('$.preferences'),
                flightPlan: sfn.JsonPath.objectAt('$.flightPlan.Payload'),
                hotelPlan: sfn.JsonPath.objectAt('$.hotelPlan.Payload'),
                carPlan: sfn.JsonPath.objectAt('$.carPlan.Payload'),
                itineraryPlan: sfn.JsonPath.objectAt('$.itineraryPlan.Payload'),
                restaurantPlan: sfn.JsonPath.objectAt('$.restaurantPlan.Payload'),
                tipsPlan: sfn.JsonPath.objectAt('$.tipsPlan.Payload')
            }),
            outputPath: '$.Payload'
        });
        const fail = new tasks.LambdaInvoke(this, 'Mark Trip Failed', {
            lambdaFunction: failFn,
            payload: sfn.TaskInput.fromObject({
                tripId: sfn.JsonPath.stringAt('$.tripId'),
                cause: sfn.JsonPath.stringAt('$.errorInfo.Cause')
            }),
            outputPath: '$.Payload'
        });
        planFlights.addCatch(fail, { resultPath: '$.errorInfo' });
        planHotels.addCatch(fail, { resultPath: '$.errorInfo' });
        planCar.addCatch(fail, { resultPath: '$.errorInfo' });
        planItinerary.addCatch(fail, { resultPath: '$.errorInfo' });
        planRestaurants.addCatch(fail, { resultPath: '$.errorInfo' });
        planTips.addCatch(fail, { resultPath: '$.errorInfo' });
        finalize.addCatch(fail, { resultPath: '$.errorInfo' });
        const definition = planFlights
            .next(planHotels)
            .next(planCar)
            .next(planItinerary)
            .next(planRestaurants)
            .next(planTips)
            .next(finalize);
        const logGroup = new logs.LogGroup(this, 'TripPlannerLogs', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY
        });
        const stateMachine = new sfn.StateMachine(this, 'TripPlannerStateMachine', {
            definitionBody: sfn.DefinitionBody.fromChainable(definition),
            timeout: aws_cdk_lib_1.Duration.minutes(5),
            logs: {
                destination: logGroup,
                level: sfn.LogLevel.ALL
            }
        });
        createTripFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
        getTripFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
        finalizeFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
        failFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
        stateMachine.grantStartExecution(createTripFn);
        const httpApi = new apigwv2.HttpApi(this, 'GoNowHttpApi', {
            apiName: 'gonow-api'
        });
        httpApi.addRoutes({
            path: '/trips',
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwIntegrations.HttpLambdaIntegration('CreateTripIntegration', createTripFn)
        });
        httpApi.addRoutes({
            path: '/trips/{tripId}',
            methods: [apigwv2.HttpMethod.GET],
            integration: new apigwIntegrations.HttpLambdaIntegration('GetTripIntegration', getTripFn)
        });
        new aws_cdk_lib_1.CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
        new aws_cdk_lib_1.CfnOutput(this, 'TripsTableName', { value: tripsTable.tableName });
        new aws_cdk_lib_1.CfnOutput(this, 'ResultsTableName', { value: resultsTable.tableName });
        new aws_cdk_lib_1.CfnOutput(this, 'TripPlannerStateMachineArn', { value: stateMachine.stateMachineArn });
    }
    createPlannerFunction(id, handler, codePath, environment) {
        return new lambda.Function(this, id, {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler,
            code: lambda.Code.fromAsset(codePath),
            timeout: aws_cdk_lib_1.Duration.seconds(15),
            environment
        });
    }
}
exports.GoNowBackendStack = GoNowBackendStack;
