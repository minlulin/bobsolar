'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { login } from '@/actions/auth-actions';
import { getPublicCompanyBranding } from '@/actions/settings-actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const brandingQuery = useQuery({
    queryKey: ['public', 'branding'],
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
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginInput): Promise<void> {
    setIsLoading(true);
    try {
      const result = await login(data);
      if (!result.success) {
        toast.error(result.error);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('[login]', err);
      const message =
        process.env.NODE_ENV === 'development' && err instanceof Error
          ? err.message
          : 'An unexpected error occurred';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const logoSrc = brandingQuery.data?.logoUrl || '/icons/logo.png';
  const companyName = brandingQuery.data?.companyName || 'BOB Solar';

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#F59E0B20,transparent_50%)]" />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-amber-500/10 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute -right-[10%] -bottom-[10%] h-[40%] w-[40%] rounded-full bg-emerald-500/10 blur-[100px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 w-full max-w-md"
      >
        <Card className="glass border-none shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mb-4 flex justify-center">
              <div className="bg-solar shadow-solar relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
                <Image
                  src={logoSrc}
                  alt={`${companyName} Logo`}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  className="absolute inset-0 rounded-2xl border-2 border-white/20"
                />
              </div>
            </div>
            <CardTitle className="font-heading text-3xl font-bold tracking-tight">
              {companyName}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to manage your solar projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                void handleSubmit(onSubmit)(e);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  {...register('email')}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-destructive text-xs">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-solar shadow-solar h-11 w-full text-base font-medium text-white transition-all hover:opacity-90 active:scale-95"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-8 text-center text-sm">
          © 2026 BOB Solar.The Art Of Clean Logic, Vibes by Minlulin .
        </p>
      </motion.div>
    </div>
  );
}
