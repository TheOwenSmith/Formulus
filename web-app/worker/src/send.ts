import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqs } from './index';
import { config } from './lib/config';

async function main() {
  const QueueUrl = config.getKey('QUEUE_URL');
  const submissionId = `sub_${Date.now()}`;

  const resp = await sqs.send(
    new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify({ submissionId }),
    }),
  );

  console.log('Sent:', { submissionId, messageId: resp.MessageId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
