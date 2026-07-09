#!/bin/bash
set -euo pipefail

echo "Initializing AWS resources..."

REGION="${AWS_DEFAULT_REGION:-us-east-2}"

awslocal sqs create-queue \
  --queue-name backtest-jobs \
  --region "$REGION"

echo "AWS resources initialized"
