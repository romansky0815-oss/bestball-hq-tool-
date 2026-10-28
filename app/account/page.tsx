import { isPro, requireUser } from "@/lib/auth";
import { stripeEnabled } from "@/lib/stripe";
import { PRO_PRICE_LABEL } from "@/lib/plans";
import { Flash } from "@/components/ui";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status } = await searchParams;
  const pro = isPro(user);
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Account</h1>
      <Flash ok={status === "success" ? "Thanks for subscribing! Pro unlocks as soon as payment confirms." : undefined} err={status === "cancelled" ? "Checkout cancelled." : undefined} />
      <div className="card">
        <p><strong>{user.email}</strong></p>
        <p>
          Plan: {pro ? <span className="tag PRO">Pro</span> : <span className="tag">Free</span>}
          {user.role === "ADMIN" && <span className="muted small"> (admin — all features unlocked)</span>}
          {user.subscriptionStatus && <span className="muted small"> · subscription {user.subscriptionStatus}</span>}
        </p>
        {!stripeEnabled() ? (
          <p className="muted small">Payments aren&apos;t configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID (see README).</p>
        ) : user.plan === "PRO" && user.stripeCustomerId ? (
          <form action="/api/stripe/portal" method="post"><button className="btn">Manage billing</button></form>
        ) : !pro ? (
          <form action="/api/stripe/checkout" method="post"><button className="btn primary">Upgrade to Pro — {PRO_PRICE_LABEL}</button></form>
        ) : null}
      </div>
    </div>
  );
}
