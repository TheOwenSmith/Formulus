import { SQSClient } from '@aws-sdk/client-sqs';
import { config } from './config';

const region = config.getKey('AWS_REGION');

export const sqs =
  config.env === 'dev'
    ? new SQSClient({
        region,
        endpoint: config.getDevKey('AWS_ENDPOINT_URL'),
      })
    : new SQSClient({ region });
