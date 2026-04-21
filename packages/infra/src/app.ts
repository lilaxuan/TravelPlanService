import { App } from 'aws-cdk-lib';
import { GoNowBackendStack } from './stacks/gonow-backend-stack.js';

const app = new App();

new GoNowBackendStack(app, 'GoNowBackendStack', {
  env: {
    account: '766796016263',
    region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2'
  }
});
