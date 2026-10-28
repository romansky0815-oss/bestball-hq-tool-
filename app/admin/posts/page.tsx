import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deletePost, savePost } from "@/app/actions/admin";
import { Flash } from "@/components/ui";

export default async function AdminPosts({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  await requireAdmin();
  const { edit, error } = await searchParams;
  const posts = await db.post.findMany({ orderBy: { publishedAt: "desc" } });
  const post = edit ? posts.find((p) => p.id === edit) : undefined;

  return (
    <div className="stack">
      <h1>Newsletter</h1>
      <Flash err={error} />
      <form action={savePost} className="card stack">
        <h2>{post ? "Edit post" : "New post"}</h2>
        {post && <input type="hidden" name="id" value={post.id} />}
        <div className="grid g2">
          <div className="field"><label>Title</label><input name="title" required defaultValue={post?.title} /></div>
          <div className="field">
            <label>Category</label>
            <select name="category" defaultValue={post?.category ?? "INJURY"}>
              <option value="INJURY">Injury</option><option value="RANKINGS">Rankings</option>
              <option value="STRATEGY">Strategy</option><option value="NEWS">News</option>
            </select>
          </div>
        </div>
        <div className="field"><label>Teaser (shown in the list)</label><input name="excerpt" defaultValue={post?.excerpt ?? ""} /></div>
        <div className="field">
          <label>Body (markdown: # heading, **bold**, *italic*, - list, [link](https://…))</label>
          <textarea name="body" required defaultValue={post?.body} style={{ minHeight: 300, fontFamily: "inherit", fontSize: "1rem" }} />
        </div>
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="checkbox" name="premium" defaultChecked={post?.premium ?? true} style={{ width: "auto" }} /> Pro only (free readers see the first two paragraphs)
        </label>
        <div className="row">
          <button className="btn primary">{post ? "Save changes" : "Publish"}</button>
          {post && <Link href="/admin/posts" className="btn">Cancel</Link>}
        </div>
      </form>

      <div className="card table-wrap">
        <table>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td><span className={`tag ${p.category}`}>{p.category}</span></td>
                <td><Link href={`/news/${p.slug}`}>{p.title}</Link> {p.premium && <span className="tag PRO">Pro</span>}</td>
                <td className="muted small">{p.publishedAt.toLocaleString()}</td>
                <td><Link className="btn sm" href={`/admin/posts?edit=${p.id}`}>Edit</Link></td>
                <td>
                  <form action={deletePost}><input type="hidden" name="id" value={p.id} /><button className="btn sm danger">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
