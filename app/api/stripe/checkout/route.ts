import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, stripe } from "@/lib/stripe";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`, 303);
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    success_url: `${appUrl()}/account?status=success`,
    cancel_url: `${appUrl()}/account?status=cancelled`,
  });
  return NextResponse.redirect(session.url!, 303);
}
