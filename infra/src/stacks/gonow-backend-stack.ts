import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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

    const tripCacheTable = new dynamodb.Table(this, 'TripGenerationCacheTable', {
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY
    });

    // ── Users table (single-table: profile + preferences + trip history) ──
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    // GSI: look up user by email
    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // ── Cognito User Pool ──────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'GoNowUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: { minLength: 8, requireSymbols: false },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('GoNowWebClient', {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
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
        flightPlan: sfn.JsonPath.objectAt('$.plannerResults[0].flightPlan.Payload'),
        hotelPlan: sfn.JsonPath.objectAt('$.plannerResults[1].hotelPlan.Payload'),
        carPlan: sfn.JsonPath.objectAt('$.plannerResults[2].carPlan.Payload'),
        itineraryPlan: sfn.JsonPath.objectAt('$.plannerResults[3].itineraryPlan.Payload'),
        restaurantPlan: sfn.JsonPath.objectAt('$.plannerResults[4].restaurantPlan.Payload'),
        tipsPlan: sfn.JsonPath.objectAt('$.plannerResults[5].tipsPlan.Payload')
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

    finalize.addCatch(fail, { resultPath: '$.errorInfo' });

    const parallelPlanning = new sfn.Parallel(this, 'Plan Trip Sections In Parallel', {
      resultPath: '$.plannerResults'
    });

    parallelPlanning
      .branch(planFlights)
      .branch(planHotels)
      .branch(planCar)
      .branch(planItinerary)
      .branch(planRestaurants)
      .branch(planTips);
    parallelPlanning.addCatch(fail, { resultPath: '$.errorInfo' });

    const definition = parallelPlanning.next(finalize);

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
      apiName: 'gonow-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
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

    // ── User Lambda handlers ───────────────────────────────────────────────
    const userEnv = {
      USERS_TABLE_NAME: usersTable.tableName,
      USER_POOL_ID: userPool.userPoolId,
    };

    const generateTripFn = new lambda.Function(this, 'GenerateTripFunction', {
      runtime: nodeRuntime,
      handler: 'handlers/generateTrip.handler',
      code: lambda.Code.fromAsset(serviceCodePath),
      timeout: Duration.seconds(60),
      environment: {
        RESULTS_TABLE_NAME: resultsTable.tableName,
        TRIP_CACHE_TABLE_NAME: tripCacheTable.tableName,
        TRIP_CACHE_TTL_SECONDS: '86400',
        OPENAI_MODEL: 'gpt-4o-mini',
        OPENAI_SECTION_TIMEOUT_MS: '25000',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
      },
    });
    resultsTable.grantReadWriteData(generateTripFn);
    tripCacheTable.grantReadWriteData(generateTripFn);

    httpApi.addRoutes({
      path: '/generate',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwIntegrations.HttpLambdaIntegration('GenerateTripIntegration', generateTripFn),
    });

    const getUserProfileFn = new lambda.Function(this, 'GetUserProfileFunction', {
      runtime: nodeRuntime,
      handler: 'handlers/getUserProfile.handler',
      code: lambda.Code.fromAsset(serviceCodePath),
      timeout: Duration.seconds(10),
      environment: userEnv,
    });

    const putUserPreferencesFn = new lambda.Function(this, 'PutUserPreferencesFunction', {
      runtime: nodeRuntime,
      handler: 'handlers/putUserPreferences.handler',
      code: lambda.Code.fromAsset(serviceCodePath),
      timeout: Duration.seconds(10),
      environment: userEnv,
    });

    usersTable.grantReadWriteData(getUserProfileFn);
    usersTable.grantReadWriteData(putUserPreferencesFn);

    // Cognito JWT authorizer
    const authorizer = new HttpJwtAuthorizer('CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] }
    );

    httpApi.addRoutes({
      path: '/users/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwIntegrations.HttpLambdaIntegration('GetUserProfileIntegration', getUserProfileFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: '/users/me/preferences',
      methods: [apigwv2.HttpMethod.PUT],
      integration: new apigwIntegrations.HttpLambdaIntegration('PutUserPreferencesIntegration', putUserPreferencesFn),
      authorizer,
    });

    // ── Public stats endpoint (signup counter) ────────────────────────────
    const getStatsFn = new lambda.Function(this, 'GetStatsFunction', {
      runtime: nodeRuntime,
      handler: 'handlers/getStats.handler',
      code: lambda.Code.fromAsset(serviceCodePath),
      timeout: Duration.seconds(5),
      environment: userEnv,
    });
    usersTable.grantReadData(getStatsFn);

    httpApi.addRoutes({
      path: '/stats',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwIntegrations.HttpLambdaIntegration('GetStatsIntegration', getStatsFn),
    });

    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'UsersTableName', { value: usersTable.tableName });
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
