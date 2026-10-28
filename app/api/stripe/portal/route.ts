import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { appUrl, stripe } from "@/lib/stripe";

export async function POST() {
  const user = await getUser();
  if (!user?.stripeCustomerId) return NextResponse.redirect(`${appUrl()}/account`, 303);
  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl()}/account`,
  });
  return NextResponse.redirect(session.url, 303);
}
