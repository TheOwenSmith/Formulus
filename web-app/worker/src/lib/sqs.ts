import { SQSClient } from '@aws-sdk/client-sqs';
import { config } from './config';

export const sqs = new SQSClient({
  region: config.getKey('AWS_REGION'),
  endpoint: config.getKey('AWS_ENDPOINT_URL'),
  credentials: {
    accessKeyId: config.getKey('AWS_ACCESS_KEY_ID'),
    secretAccessKey: config.getKey('AWS_SECRET_ACCESS_KEY'),
  },
});
