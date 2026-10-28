import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <div className="stack">
      <h1>Log in</h1>
      <AuthForm action={login} mode="login" />
      <p className="muted">
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
