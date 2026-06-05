import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { config } from './config';
import { prisma } from './prisma';
import { stripe } from './stripe';

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  if (sig == undefined) {
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      config.getKey('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { stripeSubscriptionId: subscription.id, stripePlanActive: isActive },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { stripePlanActive: false },
        });
        break;
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    res.status(500).send('Internal server error');
    return;
  }

  res.status(200).json({ received: true });
}
