import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { sqs } from './index';
import { config } from './lib/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const QueueUrl = config.getKey('QUEUE_URL');
  console.log('Worker listening on:', QueueUrl);

  while (true) {
    const resp = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20, // long poll
        VisibilityTimeout: 60, // fine for demo
      }),
    );

    const msg = resp.Messages?.[0];
    if (!msg) continue;

    if (!msg.Body || !msg.ReceiptHandle) {
      console.warn('Bad message:', msg);
      continue;
    }

    const { submissionId } = JSON.parse(msg.Body) as { submissionId: string };
    console.log('Received:', submissionId);

    // simulate work
    await sleep(1500);

    // ACK (delete) after success
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl,
        ReceiptHandle: msg.ReceiptHandle,
      }),
    );

    console.log('Deleted:', submissionId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
