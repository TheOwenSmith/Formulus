#!/bin/bash
set -euo pipefail

echo "Initializing AWS resources..."

REGION="${AWS_DEFAULT_REGION:-us-east-2}"

awslocal sqs create-queue \
  --queue-name backtest-jobs \
  --region "$REGION"

awslocal s3api create-bucket \
  --bucket formulus-pfps \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

awslocal s3api put-bucket-cors \
  --bucket formulus-pfps \
  --cors-configuration '{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["GET","PUT"],"AllowedOrigins":["*"],"MaxAgeSeconds":3000}]}'

awslocal s3api put-bucket-policy \
  --bucket formulus-pfps \
  --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::formulus-pfps/*"}]}'

echo "AWS resources initialized"
