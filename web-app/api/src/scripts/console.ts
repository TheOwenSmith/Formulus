import { stripe } from '@api/lib/stripe';

async function main() {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
  });
}

await main();
