import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  return (
    <div className="stack">
      <h1>Create your account</h1>
      <p className="muted">Free to start. Track up to 5 teams, then upgrade for unlimited teams and full grades.</p>
      <AuthForm action={signup} mode="signup" />
      <p className="muted">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
