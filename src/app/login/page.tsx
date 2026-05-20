"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@tng.usc.edu");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) { setError("Invalid credentials."); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <section className="hidden lg:flex flex-col justify-between bg-cardinal text-white p-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[460px] h-[460px] rounded-full bg-cardinal-700 blur-3xl opacity-70" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-gold-400/30 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-white text-cardinal grid place-items-center font-display font-black text-lg">USC</div>
            <div>
              <div className="font-display text-xl leading-tight tracking-tight">Private Events</div>
              <div className="text-xs text-white/70">&amp; Conferences</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="font-display text-5xl leading-tight">Banquet Operations, Reimagined.</h1>
          <p className="text-white/80 text-lg">
            Plan BEOs, schedule banquet staff by seniority, and print posting-ready
            rosters across UPC, HSC, U Club, and USC Hotel — all in one place.
          </p>
          <div className="flex gap-2">
            <span className="pill bg-white/10 text-white border border-white/20">BEO Management</span>
            <span className="pill bg-white/10 text-white border border-white/20">AI Scheduling</span>
            <span className="pill bg-white/10 text-white border border-white/20">Drag &amp; Drop</span>
          </div>
        </div>
        <div className="relative z-10 text-xs text-white/60">
          Private Events &amp; Conferences · University of Southern California
        </div>
      </section>

      {/* Login form */}
      <section className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="space-y-1">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-md bg-cardinal text-white grid place-items-center font-display font-black">USC</div>
              <span className="font-display text-lg">Private Events &amp; Conferences</span>
            </div>
            <h2 className="font-display text-3xl">Sign in</h2>
            <p className="text-sm text-ink-muted">Welcome back. Use your operations credentials.</p>
          </div>
          {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-sm">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="text-xs text-ink-muted">
            Demo accounts (password: <code className="font-mono">password123</code>):<br />
            <span className="font-mono">admin@tng.usc.edu</span> · <span className="font-mono">manager@tng.usc.edu</span> · <span className="font-mono">supervisor@tng.usc.edu</span>
          </div>
        </form>
      </section>
    </main>
  );
}
