import serverlessExpress from '@codegenie/serverless-express';
import 'source-map-support/register.js';
import { app } from './index';

export const handler = serverlessExpress({ app, resolutionMode: 'PROMISE' });
