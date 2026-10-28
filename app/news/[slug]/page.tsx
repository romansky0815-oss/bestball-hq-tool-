import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser, isPro } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { Paywall } from "@/components/ui";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await db.post.findUnique({ where: { slug } });
  if (!post) notFound();
  const locked = post.premium && !isPro(await getUser());
  // Free readers get the first couple of paragraphs as a teaser.
  const body = locked ? post.body.split(/\n\s*\n/).slice(0, 2).join("\n\n") : post.body;
  return (
    <article className="stack prose">
      <div className="row">
        <span className={`tag ${post.category}`}>{post.category}</span>
        {post.premium && <span className="tag PRO">Pro</span>}
        <span className="muted small">{post.publishedAt.toLocaleString([], { dateStyle: "long", timeStyle: "short" })}</span>
      </div>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
      {locked && <Paywall what="The rest of this post" />}
    </article>
  );
}
