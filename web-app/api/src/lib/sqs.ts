import { SQSClient } from '@aws-sdk/client-sqs';
import { config } from './config';

const region = config.getKey('AWS_REGION');
const endpoint = process.env['AWS_ENDPOINT_URL'];
const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];

/** LocalStack and similar: explicit endpoint + static keys. Lambda: IAM role via default chain. */
export const sqs = new SQSClient({
  region,
  ...(endpoint ? { endpoint } : {}),
  ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
});
