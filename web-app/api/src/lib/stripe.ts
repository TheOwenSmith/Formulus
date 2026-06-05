// stripe listen --forward-to localhost:8080/api/stripe/webhook

import Stripe from 'stripe';
import { config } from './config';

export const stripe = new Stripe(config.getKey('STRIPE_API_KEY'));
