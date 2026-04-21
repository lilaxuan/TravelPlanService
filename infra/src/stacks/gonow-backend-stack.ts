import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class GoNowBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const tripsTable = new dynamodb.Table(this, 'TripsTable', {
      partitionKey: { name: 'tripId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const resultsTable = new dynamodb.Table(this, 'TripResultsTable', {
      partitionKey: { name: 'tripId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const nodeRuntime = lambda.Runtime.NODEJS_20_X;
    const baseEnv = {
      TRIPS_TABLE_NAME: tripsTable.tableName,
      RESULTS_TABLE_NAME: resultsTable.tableName,
    };

    const serviceCodePath = '../service/dist';

    const createTripFn = new lambda.Function(this, 'CreateTripFunction', {
      runtime: nodeRuntime,
      handler: 'handlers/createTrip.handler',
      code: lambda.Code.fromAsset(serviceCodePath),
      timeout: Duration.seconds(15),
      environment: baseEnv
    });

    const getTripFn = new lambda.Function(this, 'GetTripFunction', {
      runtime: nodeRuntime,
      handler: 'handlers/getTrip.handler',
      code: lambda.Code.fromAsset(serviceCodePath),
      timeout: Duration.seconds(10),
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
      removalPolicy: RemovalPolicy.DESTROY
    });

    const stateMachine = new sfn.StateMachine(this, 'TripPlannerStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: Duration.minutes(5),
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL
      }
    });

    createTripFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
    // getTripFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
    // finalizeFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
    // failFn.addEnvironment('TRIP_PLANNER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
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

    new CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'TripsTableName', { value: tripsTable.tableName });
    new CfnOutput(this, 'ResultsTableName', { value: resultsTable.tableName });
    new CfnOutput(this, 'TripPlannerStateMachineArn', { value: stateMachine.stateMachineArn });
  }

  private createPlannerFunction(id: string, handler: string, codePath: string, environment: Record<string, string>): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler,
      code: lambda.Code.fromAsset(codePath),
      timeout: Duration.seconds(15),
      environment
    });
  }
}
