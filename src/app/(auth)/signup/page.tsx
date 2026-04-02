"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ── Validation (unchanged) ────────────────────────────────────────────────────

const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

// ── Shared glass card style ───────────────────────────────────────────────────

const glassStyle: React.CSSProperties = {
  background: "rgba(9, 9, 30, 0.72)",
  backdropFilter: "blur(22px)",
  WebkitBackdropFilter: "blur(22px)",
  border: "1px solid rgba(139, 92, 246, 0.22)",
  boxShadow: [
    "0 0 0 1px rgba(255,255,255,0.04) inset",
    "0 0 60px rgba(139,92,246,0.08)",
    "0 25px 60px rgba(0,0,0,0.65)",
  ].join(", "),
};

const inputClass =
  "border-white/10 bg-white/5 text-white placeholder:text-white/25 " +
  "focus-visible:border-violet-500/60 focus-visible:ring-1 focus-visible:ring-violet-500/30 " +
  "hover:border-white/20 transition-colors";

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignupPage() {
  // Auth logic — unchanged
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    setVerificationSent(true);
  }

  // ── Email verification state (unchanged logic, restyled) ──────────────────
  if (verificationSent) {
    return (
      <div className="w-full max-w-sm rounded-2xl p-6 text-center sm:p-8" style={glassStyle}>
        <div className="mb-4 text-4xl">✉️</div>
        <h2 className="text-xl font-semibold text-white">Check your email</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          We sent a verification link to your email address. Click it to activate
          your account, then{" "}
          <Link
            href="/login"
            className="text-violet-400 underline underline-offset-4 transition-colors hover:text-violet-300"
          >
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl p-6 sm:p-8" style={glassStyle}>
      {/* Header */}
      <div className="mb-7">
        <h2 className="text-xl font-semibold text-white">Create an account</h2>
        <p className="mt-1 text-sm text-white/45">Start tracking your finances today</p>
      </div>

      {/* Form — all fields and validation logic unchanged */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {serverError}
            </p>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-white/60">Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" className={inputClass} {...field} />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-white/60">Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" className={inputClass} {...field} />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-white/60">Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" className={inputClass} {...field} />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />

          <div className="space-y-4 pt-1">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full border-0 font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                boxShadow: "0 4px 24px rgba(124,58,237,0.35)",
              }}
            >
              {form.formState.isSubmitting ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-center text-sm text-white/35">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-violet-400 underline underline-offset-4 transition-colors hover:text-violet-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
}
