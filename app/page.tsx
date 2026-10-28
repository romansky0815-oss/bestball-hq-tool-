import Link from "next/link";
import { BRAND, FREE_TEAM_LIMIT, PRO_PRICE_LABEL } from "@/lib/plans";
import { db } from "@/lib/db";

export default async function Home() {
  const posts = await db.post.findMany({ orderBy: { publishedAt: "desc" }, take: 3 });
  return (
    <div className="stack">
      <section className="hero">
        <h1>Know exactly how your best ball portfolio stacks up.</h1>
        <p>
          {BRAND} grades every team you draft against thousands of &ldquo;ADP twins&rdquo; — teams built at the same picks
          with the same positions — tracks your exposure so you stop drafting the same team twice, and keeps you current
          with rankings and injury news.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn primary">Start free</Link>
          <Link href="/rankings" className="btn">See the rankings</Link>
        </div>
      </section>

      <section className="grid g4">
        <Feature title="ADP-twin team grades" body="Your team vs. hundreds of simulated teams drafted at the same pick numbers and positions. Percentile, letter grade, and which picks hit or missed." />
        <Feature title="Exposure tracking" body="Player exposure %, average pick vs. current ADP, QB stacks, position builds, and repeated 2- and 3-player cores." />
        <Feature title="Duplicate-team alerts" body="Flags teams that share the same early-round core so your portfolio stays diversified for large-field tournaments." />
        <Feature title="Rankings + newsletter" body="Best ball rankings with tiers and movement, plus injury and strategy updates the moment they're published." />
      </section>

      <section className="grid g2" style={{ marginTop: 24 }}>
        <div className="card">
          <h2>Free</h2>
          <div className="stat"><div className="value">$0</div></div>
          <ul>
            <li>Up to {FREE_TEAM_LIMIT} teams</li>
            <li>Exposure dashboard</li>
            <li>Top-24 rankings</li>
            <li>Free newsletter posts</li>
          </ul>
          <Link href="/signup" className="btn">Sign up</Link>
        </div>
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2>Pro</h2>
          <div className="stat"><div className="value">{PRO_PRICE_LABEL}</div></div>
          <ul>
            <li>Unlimited teams + CSV import</li>
            <li>ADP-twin grades and pick-by-pick breakdowns</li>
            <li>Duplicate-team and core-combo alerts</li>
            <li>Full rankings with tiers and notes</li>
            <li>Every newsletter: injuries, ranking updates, strategy</li>
          </ul>
          <Link href="/signup" className="btn primary">Go Pro</Link>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="card">
          <h2>Latest from the newsletter</h2>
          {posts.map((p) => (
            <div key={p.id} style={{ padding: "8px 0" }}>
              <span className={`tag ${p.category}`}>{p.category}</span>{" "}
              <Link href={`/news/${p.slug}`}><strong>{p.title}</strong></Link>{" "}
              <span className="muted small">{p.publishedAt.toLocaleDateString()}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="muted small" style={{ margin: 0 }}>{body}</p>
    </div>
  );
}
