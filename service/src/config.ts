export interface AppConfig {
  tripsTableName: string;
  resultsTableName: string;
  tripPlannerStateMachineArn: string;
  region: string;
}

export function loadConfig(): AppConfig {
  const tripsTableName = process.env.TRIPS_TABLE_NAME;
  const resultsTableName = process.env.RESULTS_TABLE_NAME;
  const tripPlannerStateMachineArn = process.env.TRIP_PLANNER_STATE_MACHINE_ARN;
  const region = process.env.AWS_REGION ?? 'us-west-2';

  if (!tripsTableName || !resultsTableName || !tripPlannerStateMachineArn) {
    throw new Error('Missing required environment variables');
  }

  return {
    tripsTableName,
    resultsTableName,
    tripPlannerStateMachineArn,
    region
  };
}
