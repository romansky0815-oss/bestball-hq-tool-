import Link from "next/link";
import { getUser, isPro } from "@/lib/auth";
import { BRAND } from "@/lib/plans";
import { logout } from "@/app/actions/auth";

export default async function Nav() {
  const user = await getUser();
  const [first, ...rest] = BRAND.split(" ");
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          {first}
          <span>{rest.length ? " " + rest.join(" ") : ""}</span>
        </Link>
        {user && <Link href="/dashboard">Dashboard</Link>}
        {user && <Link href="/teams">Teams</Link>}
        {user && <Link href="/exposure">Exposure</Link>}
        <Link href="/rankings">Rankings</Link>
        <Link href="/news">Newsletter</Link>
        {user?.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        <div className="spacer" />
        {user ? (
          <>
            <Link href="/account">{isPro(user) ? <span className="tag PRO">Pro</span> : "Upgrade"}</Link>
            <form action={logout}>
              <button className="btn sm">Log out</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn primary sm">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
