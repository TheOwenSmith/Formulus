import { SQSClient } from '@aws-sdk/client-sqs';
import { config } from './config';

const region = config.getKey('AWS_REGION');

export const sqs =
  config.env === 'dev'
    ? new SQSClient({
        region,
        endpoint: config.getDevKey('AWS_ENDPOINT_URL'),
        credentials: {
          accessKeyId: config.getDevKey('AWS_ACCESS_KEY_ID'),
          secretAccessKey: config.getDevKey('AWS_SECRET_ACCESS_KEY'),
        },
      })
    : new SQSClient({ region });
