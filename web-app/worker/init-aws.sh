#!/bin/bash
echo "Initializing AWS resources..."
awslocal sqs create-queue --queue-name backtest-jobs
echo "AWS resources initialized"
