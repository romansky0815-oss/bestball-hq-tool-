import Link from "next/link";
import { db } from "@/lib/db";

const CATS = ["INJURY", "RANKINGS", "STRATEGY", "NEWS"];

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const posts = await db.post.findMany({ where: cat ? { category: cat } : {}, orderBy: { publishedAt: "desc" } });
  return (
    <div className="stack">
      <h1>Newsletter</h1>
      <div className="tabs">
        <Link href="/news" className={!cat ? "on" : ""}>All</Link>
        {CATS.map((c) => <Link key={c} href={`/news?cat=${c}`} className={cat === c ? "on" : ""}>{c[0] + c.slice(1).toLowerCase()}</Link>)}
      </div>
      {posts.map((p) => (
        <Link key={p.id} href={`/news/${p.slug}`} className="card" style={{ textDecoration: "none", display: "block" }}>
          <div className="row">
            <span className={`tag ${p.category}`}>{p.category}</span>
            {p.premium && <span className="tag PRO">Pro</span>}
            <span className="muted small">{p.publishedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <h2 style={{ margin: "8px 0 4px" }}>{p.title}</h2>
          {p.excerpt && <p className="muted" style={{ margin: 0 }}>{p.excerpt}</p>}
        </Link>
      ))}
      {!posts.length && <p className="muted">Nothing here yet.</p>}
    </div>
  );
}
