# Infra deployment notes

## Build order
From repository root:
```bash
npm install --force
npm run build -w @gonow/shared
npm run build -w @gonow/service
npm run build -w @gonow/infra

cd packages/shared
npm install
npm run build

cd ../service
npm install
npm run build

cd ../infra
npm install
npm run build
```

## Deploy
```bash
// Go to the dir where the app.js is built in dist
cd ..
npx cdk bootstrap aws://766796016263/us-west-2

cd packages/shared
npm run build

cd ../service
npm run build

cd ../infra
npm run build

// set up the AWS credential
aws configure
aws sts-get-identity
npm install -g aws-cdk
cdk bootstrap

npx cdk deploy GoNowBackendStack --require-approval never
```

## Notes
- Lambda assets expect compiled handler files under `packages/service/dist`
- Update removal policies before production deployment
- Add custom domain, WAF, alarms, and CI/CD before production use
