"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { loginSchema, type LoginFormData } from "@/lib/validators/auth.schema";

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    clearError();
    login(data);
  };

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Welcome Back</h2>
        <p className="text-sm text-neutral-500 mt-1.5">Sign in to your Anava account</p>
      </div>

      {error && (
        <div
          className={`mb-5 px-4 py-3 rounded-lg text-sm border ${
            error === "You will be able to log in once your account is approved."
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : error === "Your account has been rejected. Please contact reception."
              ? "bg-orange-50 border-orange-200 text-orange-800"
              : "bg-danger-50 border-danger-100 text-danger-700"
          }`}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          autoComplete="email"
          {...register("email")}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          autoComplete="current-password"
          {...register("password")}
        />
        <Button type="submit" className="w-full mt-1" size="lg" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}
