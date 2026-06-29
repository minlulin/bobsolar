"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { login } from "@/actions/auth-actions";
import { getPublicCompanyBranding } from "@/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginInput, loginSchema } from "@/lib/validators/auth";

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const brandingQuery = useQuery({
    queryKey: ["public", "branding"],
    queryFn: async () => {
      const res = await getPublicCompanyBranding();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput): Promise<void> {
    setIsLoading(true);
    try {
      const result = await login(data);
      if (!result.success) {
        toast.error(result.error);
      } else {
        // SECURITY: Validate the `next` parameter to prevent open redirect.
        // Only accept relative paths (starting with "/") that don't begin with "//".
        const next = searchParams.get("next");
        if (next?.startsWith("/") && !next.startsWith("//")) {
          router.push(next);
        } else {
          router.push("/");
        }
      }
    } catch (err) {
      console.error("[login]", err);
      const message =
        process.env.NODE_ENV === "development" && err instanceof Error
          ? err.message
          : "An unexpected error occurred";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const logoSrc = brandingQuery.data?.logoUrl || "/icons/logo.png";
  const companyName = brandingQuery.data?.companyName || "BOB Solar";

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--background)_88%,white)_0%,var(--background)_52%,color-mix(in_oklab,var(--solar)_10%,var(--background))_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-solar/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--solar)_16%,transparent),transparent_42%)]" />
        <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] bg-size-[44px_44px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <Card className="surface-panel overflow-hidden rounded-2xl border py-0 shadow-none">
          <CardHeader className="border-border/70 bg-card/80 border-b px-6 pt-7 pb-5 text-center sm:px-8">
            <div className="mb-5 flex justify-center">
              <div className="bg-solar shadow-solar ring-background relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl ring-4">
                <Image
                  src={logoSrc}
                  alt={`${companyName} Logo`}
                  fill
                  sizes="80px"
                  priority
                  className="object-contain p-2.5"
                  unoptimized
                />
              </div>
            </div>
            <CardTitle className="font-heading text-foreground text-2xl font-semibold tracking-tight">
              {companyName}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Operations console sign in
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-6 sm:px-8">
            <form
              onSubmit={(e) => {
                void handleSubmit(onSubmit)(e);
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground text-xs font-semibold">
                  Username
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="Enter your username"
                  autoComplete="username"
                  {...register("email")}
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={
                    errors.email
                      ? "h-10 border-destructive bg-background/70 px-3"
                      : "h-10 bg-background/70 px-3"
                  }
                />
                {errors.email && (
                  <p id="email-error" role="alert" className="text-destructive text-xs">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground text-xs font-semibold">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                    aria-invalid={errors.password ? "true" : "false"}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className={
                      errors.password
                        ? "h-10 border-destructive bg-background/70 px-3 pr-11"
                        : "h-10 bg-background/70 px-3 pr-11"
                    }
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/40 absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-transparent transition outline-none focus-visible:ring-2"
                    onClick={() => {
                      setShowPassword((prev) => !prev);
                    }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" role="alert" className="text-destructive text-xs">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="solar-cta h-10 w-full text-sm font-semibold transition-transform active:translate-y-px"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
            <div className="text-muted-foreground mt-5 flex items-center justify-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Private BOB Solar workspace</span>
            </div>
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          © 2026 BOB Solar. The Art of Clean Logic.
        </p>
      </motion.div>
    </div>
  );
}
