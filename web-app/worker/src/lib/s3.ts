import { S3Client } from '@aws-sdk/client-s3';
import { config } from './config';

const region = config.getKey('AWS_REGION');

export const s3 =
  config.env === 'dev'
    ? new S3Client({
        region,
        endpoint: config.getDevKey('AWS_ENDPOINT_URL'),
        forcePathStyle: true,
      })
    : new S3Client({ region });
