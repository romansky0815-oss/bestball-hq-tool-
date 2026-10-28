import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

// Keeps User.plan in sync with Stripe. Point a Stripe webhook at /api/stripe/webhook
// for: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    if (s.customer && s.client_reference_id)
      await db.user.update({
        where: { id: s.client_reference_id },
        data: { stripeCustomerId: String(s.customer), plan: "PRO", subscriptionStatus: "active" },
      });
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    await db.user.updateMany({
      where: { stripeCustomerId: String(sub.customer) },
      data: { plan: ACTIVE.has(sub.status) ? "PRO" : "FREE", subscriptionStatus: sub.status },
    });
  }
  return NextResponse.json({ received: true });
}
