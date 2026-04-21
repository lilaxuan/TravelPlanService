"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws_cdk_lib_1 = require("aws-cdk-lib");
const gonow_backend_stack_js_1 = require("./stacks/gonow-backend-stack.js");
const app = new aws_cdk_lib_1.App();
new gonow_backend_stack_js_1.GoNowBackendStack(app, 'GoNowBackendStack', {
    env: {
        account: '766796016263',
        region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2'
    }
});
