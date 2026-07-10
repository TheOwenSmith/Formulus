import { S3Client } from '@aws-sdk/client-s3';
import { config } from './config';

const region = config.getKey('AWS_REGION');

export const s3 =
  config.env === 'dev'
    ? new S3Client({
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        endpoint: config.getDevKey('AWS_ENDPOINT_URL'),
        forcePathStyle: true,
        region,
        // For AWS localstack compatibility
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      })
    : new S3Client({ region });
