import { config } from '@api/lib/config';
import { prisma } from '@api/lib/prisma';
import { stripe } from '@api/lib/stripe';
import type { TRPCContext } from '@api/lib/trpc';
import type { createUserAuthenticationProcedure } from '@api/middleware/authentication';
import { badRequest, fromThrowableAsync, internal } from '@api/utils/error-handling';
import z from 'zod';

export function paymentsRouter(
  router: TRPCContext['router'],
  authProcedure: ReturnType<typeof createUserAuthenticationProcedure>,
) {
  return router({
    createCheckoutSession: authProcedure
      .input(z.object({ cancelUrl: z.string(), successUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = ctx;

        const userResult = await fromThrowableAsync(
          () => prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true, stripePlanActive: true } }),
          (e) => internal(e, 'Failed to load user'),
        );
        if (userResult.isErr()) throw userResult.error;
        if (userResult.value?.stripePlanActive) throw badRequest('You already have an active Pro subscription');

        let customerId = userResult.value?.stripeCustomerId ?? null;

        if (!customerId) {
          const customerResult = await fromThrowableAsync(
            () => stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } }),
            (e) => internal(e, 'Failed to create Stripe customer'),
          );
          if (customerResult.isErr()) throw customerResult.error;
          customerId = customerResult.value.id;

          const saveResult = await fromThrowableAsync(
            () => prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } }),
            (e) => internal(e, 'Failed to save Stripe customer'),
          );
          if (saveResult.isErr()) throw saveResult.error;
        }

        const sessionResult = await fromThrowableAsync(
          () =>
            stripe.checkout.sessions.create({
              cancel_url: input.cancelUrl,
              customer: customerId,
              line_items: [{ price: config.getKey('STRIPE_PRICE_ID'), quantity: 1 }],
              mode: 'subscription',
              success_url: input.successUrl,
            }),
          (e) => internal(e, 'Failed to create checkout session'),
        );
        if (sessionResult.isErr()) throw sessionResult.error;

        return { url: sessionResult.value.url };
      }),

    createPortalSession: authProcedure
      .input(z.object({ returnUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { user } = ctx;

        const userResult = await fromThrowableAsync(
          () => prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }),
          (e) => internal(e, 'Failed to load user'),
        );
        if (userResult.isErr()) throw userResult.error;
        if (!userResult.value?.stripeCustomerId) throw badRequest('No active subscription found');

        const sessionResult = await fromThrowableAsync(
          () =>
            stripe.billingPortal.sessions.create({
              customer: userResult.value!.stripeCustomerId!,
              return_url: input.returnUrl,
            }),
          (e) => internal(e, 'Failed to create portal session'),
        );
        if (sessionResult.isErr()) throw sessionResult.error;

        return { url: sessionResult.value.url };
      }),
  });
}
