---
name: bobsolar-project-skills
description: This file defines the technical knowledge, patterns, and code conventions an AI coding agent MUST follow when working on this project.
---

## Project Identity

- **Name:** BOB Solar
- **Type:** Progressive Web App (PWA) for solar installation management
- **Users:** 3 people (same role) — single company, non-commercial
- **Currency:** MMK (Myanmar Kyat) — no decimals needed, integer math only
- **Cost:** $0/month — all free tiers (Neon, Vercel Hobby)

---

## Tech Stack (Exact Versions)

| Technology          | Version          | Notes                                      |
| ------------------- | ---------------- | ------------------------------------------ |
| Next.js             | 16.2+            | App Router, RSC, Server Actions, Turbopack |
| React               | 19.x             | With React Compiler support                |
| TypeScript          | 6.0              | Strict mode enabled                        |
| pnpm                | Latest           | Package manager (NOT npm or yarn)          |
| Tailwind CSS        | v4+              | Utility-first CSS                          |
| shadcn/ui           | Latest           | Heavily customized with CSS variables      |
| Framer Motion       | Latest           | Animations and micro-interactions          |
| TanStack Query      | v5               | Server state management                    |
| Zustand             | Latest           | Client UI state                            |
| React Hook Form     | Latest           | Form handling                              |
| Zod                 | Latest           | Schema validation                          |
| Drizzle ORM         | Latest           | PostgreSQL dialect (`pg`)                  |
| PostgreSQL          | Neon (free tier) | 0.5GB storage, 100 CU-hours/month          |
| @react-pdf/renderer | 4.5+             | PDF generation (runs on Node.js runtime)   |
| Serwist             | Latest           | PWA service worker                         |
| Vercel              | Hobby plan       | Zero-config Next.js deployment (free tier) |
| @vercel/blob        | Latest           | File storage (logos, uploads — 1GB free)   |

---

## Skill: Next.js 16 App Router Patterns

### File Conventions

```
app/
├── layout.tsx        → Root layout (wraps all pages)
├── page.tsx          → Route page component
├── loading.tsx       → Streaming loading UI (Suspense boundary)
├── error.tsx         → Error boundary (must be 'use client')
├── not-found.tsx     → 404 page
├── manifest.ts       → PWA manifest (dynamic)
└── globals.css       → Global styles
```

### Server Components (Default)

```tsx
// app/(dashboard)/projects/page.tsx
// Server Component by default — NO 'use client' directive
import { getProjects } from '@/actions/project-actions';

export default async function ProjectsPage() {
  const projects = await getProjects();
  return <ProjectList projects={projects} />;
}
```

### Client Components

```tsx
// components/project/project-card.tsx
'use client';

import { motion } from 'framer-motion';
import { useUpdateProject } from '@/hooks/use-projects';

export function ProjectCard({ project }: { project: Project }) {
  const { mutate } = useUpdateProject();
  // Interactive UI with hooks, event handlers, animations
}
```

### Server Actions

```tsx
// actions/project-actions.ts
'use server';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

export async function createProject(data: CreateProjectInput) {
  // Always validate with Zod first
  const validated = createProjectSchema.parse(data);

  const [project] = await db.insert(projects).values(validated).returning();

  revalidatePath('/projects');
  return { success: true, data: project };
}
```

### Route Handlers (API Routes)

```tsx
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Used for: PDF generation, file upload URLs, webhooks
  return NextResponse.json({ url: presignedUrl });
}
```

### Route Groups

```
(auth)/      → Login page, no dashboard shell
(dashboard)/ → All authenticated pages with nav shell
```

---

## Skill: Drizzle ORM + Neon PostgreSQL

### Schema Definition Pattern

```tsx
// src/lib/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const projectStatusEnum = pgEnum('project_status', [
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectNumber: text('project_number').unique().notNull(),
  customerId: uuid('customer_id')
    .references(() => customers.id)
    .notNull(),
  status: projectStatusEnum('status').default('planning').notNull(),
  quotedTotal: decimal('quoted_total', { precision: 15, scale: 0 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  customer: one(customers, {
    fields: [projects.customerId],
    references: [customers.id],
  }),
  costs: many(projectCosts),
  remarks: many(projectRemarks),
}));

// Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

### Database Client

```tsx
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

### Query Patterns

```tsx
// Select with relations
const project = await db.query.projects.findFirst({
  where: eq(projects.id, projectId),
  with: { customer: true, costs: true, remarks: true },
});

// Insert returning
const [newProject] = await db.insert(projects).values(data).returning();

// Update
await db
  .update(projects)
  .set({ status: 'completed' })
  .where(eq(projects.id, id));

// Transaction
await db.transaction(async (tx) => {
  await tx.insert(quotations).values(quoteData);
  await tx.insert(quotationItems).values(itemsData);
});
```

---

## Skill: Zod Validation

### Schema Pattern

```tsx
// src/lib/validators/quotation.ts
import { z } from 'zod';

export const createQuotationSchema = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        description: z.string().min(1),
        quantity: z.number().min(0.01),
        unitPrice: z.number().min(0),
        sortOrder: z.number().int(),
      }),
    )
    .min(1, 'At least one item required'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  validUntil: z.coerce.date().optional(),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
```

### Usage in Server Actions

```tsx
export async function createQuotation(raw: unknown) {
  const result = createQuotationSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.flatten() };
  }
  // proceed with result.data
}
```

### Usage with React Hook Form

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const form = useForm<CreateQuotationInput>({
  resolver: zodResolver(createQuotationSchema),
  defaultValues: { discountPercent: 0, taxPercent: 0, items: [] },
});
```

---

## Skill: TanStack Query v5 Patterns

### Query Hook Pattern

```tsx
// src/hooks/use-projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjects,
  createProject,
  updateProject,
} from '@/actions/project-actions';

export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => getProjects(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProject,
    onMutate: async (newData) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previous = queryClient.getQueryData(['projects']);
      queryClient.setQueryData(['projects'], (old: Project[]) =>
        old.map((p) => (p.id === newData.id ? { ...p, ...newData } : p)),
      );
      return { previous };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(['projects'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
```

### Provider Setup

```tsx
// src/app/layout.tsx (or a client wrapper)
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 2 },
    mutations: { retry: 0 },
  },
});
```

---

## Skill: Zustand State Management

### Store Pattern

```tsx
// src/stores/ui-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  commandBarOpen: boolean;
  notificationPanelOpen: boolean;
  toggleCommandBar: () => void;
  toggleNotificationPanel: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  commandBarOpen: false,
  notificationPanelOpen: false,
  toggleCommandBar: () => set((s) => ({ commandBarOpen: !s.commandBarOpen })),
  toggleNotificationPanel: () =>
    set((s) => ({ notificationPanelOpen: !s.notificationPanelOpen })),
}));
```

### Quote Builder Store (Complex)

```tsx
// src/stores/quote-builder-store.ts
import { create } from 'zustand';
import { calculateQuotation } from '@/lib/pricing/engine';

interface QuoteBuilderState {
  customerId: string | null;
  items: QuoteBuilderItem[];
  discountPercent: number;
  taxPercent: number;
  // Actions
  addItem: (item: InventoryItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  reorderItems: (from: number, to: number) => void;
  reset: () => void;
  // Derived (computed in selectors)
}

// Use selectors for derived state
export const useQuoteTotals = () =>
  useQuoteBuilderStore((s) => {
    return calculateQuotation({
      items: s.items,
      discountPercent: s.discountPercent,
      taxPercent: s.taxPercent,
    });
  });
```

---

## Skill: Framer Motion Animations

### Shared Presets

```tsx
// src/lib/motion.ts
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 },
};

export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};
```

### Usage Pattern

```tsx
'use client';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/motion';

export function ProjectList({ projects }: Props) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      {projects.map((project) => (
        <motion.div key={project.id} variants={staggerItem}>
          <ProjectCard project={project} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### LazyMotion for Bundle Size

```tsx
// src/app/layout.tsx (client wrapper)
import { LazyMotion, domAnimation } from 'framer-motion';

export function Providers({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
```

---

## Skill: @react-pdf/renderer

### PDF Template Pattern

```tsx
// src/components/pdf/quote-document.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Inter' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  table: { display: 'flex', flexDirection: 'column' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
  },
  // ... more styles
});

export function QuoteDocument({ quotation, company }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {company.logoUrl && (
            <Image src={company.logoUrl} style={{ width: 80 }} />
          )}
          <View>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
              {company.name}
            </Text>
            <Text>{company.address}</Text>
          </View>
        </View>
        {/* Items table, totals, footer */}
      </Page>
    </Document>
  );
}
```

### Route Handler for PDF Generation

```tsx
// app/(dashboard)/quotations/[id]/pdf/route.ts
import { renderToStream } from '@react-pdf/renderer';
import { QuoteDocument } from '@/components/pdf/quote-document';

export const runtime = 'nodejs'; // react-pdf requires Node.js APIs — works natively on Vercel

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const quotation = await getQuotationWithDetails(params.id);
  const company = await getCompanySettings();

  const stream = await renderToStream(
    <QuoteDocument quotation={quotation} company={company} />,
  );

  return new Response(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quotation.quoteNumber}.pdf"`,
    },
  });
}
```

---

## Skill: Authentication with Database Sessions

### Session Flow

```tsx
// src/lib/auth/session.ts
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function createSession(userId: string, role: string) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await db.insert(sessions).values({ id: sessionId, userId, role, expiresAt });
  return sessionId;
}

export async function getSession(sessionId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
```

### Middleware

```tsx
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value;

  if (request.nextUrl.pathname.startsWith('/login')) {
    if (sessionId) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!sessionId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|fonts).*)'],
};
```

> **Note:** Middleware on Vercel runs at the Edge by default. For session validation
> that needs DB access, validate the session in Server Components/Actions instead
> of middleware. Middleware only checks cookie existence for fast redirects.

---

## Skill: File Upload with Vercel Blob

### Upload Pattern

```tsx
// src/lib/storage/blob.ts
import { put, del } from '@vercel/blob';

export async function uploadFile(file: File, folder: string) {
  const blob = await put(`${folder}/${file.name}`, file, {
    access: 'public',
  });
  return blob.url;
}

export async function deleteFile(url: string) {
  await del(url);
}
```

### Upload API Route

```tsx
// app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file') as File;
  const folder = form.get('folder') as string;

  const blob = await put(`${folder}/${file.name}`, file, {
    access: 'public',
  });

  return NextResponse.json({ url: blob.url });
}
```

---

## Skill: MMK Currency Formatting

```tsx
// src/lib/utils.ts
export function formatMMK(amount: number): string {
  return `${amount.toLocaleString('en-US')} MMK`;
}

// Examples:
// formatMMK(1500000)  → "1,500,000 MMK"
// formatMMK(0)        → "0 MMK"
// formatMMK(50000000) → "50,000,000 MMK"
```

### Price Calculation (Integer Math)

```tsx
// src/lib/pricing/engine.ts
export function calculateQuotation(input: {
  items: { unitPrice: number; quantity: number }[];
  discountPercent: number;
  taxPercent: number;
}) {
  const subtotal = input.items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * item.quantity),
    0,
  );
  const discountAmount = Math.round((subtotal * input.discountPercent) / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = Math.round((afterDiscount * input.taxPercent) / 100);
  const total = afterDiscount + taxAmount;

  return { subtotal, discountAmount, taxAmount, total };
}
```

---

## Skill: PWA with Serwist

### Service Worker

```tsx
// src/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

### Next.js Config Integration

```tsx
// next.config.ts
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
});

export default withSerwist({
  /* nextConfig */
});
```

---

## Skill: shadcn/ui Customization

### NEVER edit component source files directly

### ALWAYS customize via CSS variables in globals.css

```css
/* src/app/globals.css */
@layer base {
  :root {
    --background: 40 20% 98%; /* warm white */
    --foreground: 0 0% 10%;
    --primary: 38 92% 50%; /* solar amber */
    --primary-foreground: 38 100% 98%;
    --secondary: 160 84% 39%; /* energy emerald */
    --radius: 0.625rem;
  }
  .dark {
    --background: 0 0% 7%; /* #121212 Spotify dark */
    --foreground: 0 0% 93%;
    --card: 0 0% 9.5%; /* #181818 */
    --primary: 43 96% 56%; /* brighter amber for dark */
  }
}
```

### Custom Button Variants (via className, not source edit)

```tsx
// Usage
<Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400">
  New Quote
</Button>
```

---

## Skill: Response/Return Patterns

### Standardized Server Action Response

```tsx
// Always return this shape from server actions
type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Usage
export async function createCustomer(
  input: unknown,
): Promise<ActionResponse<Customer>> {
  try {
    const validated = createCustomerSchema.parse(input);
    const [customer] = await db.insert(customers).values(validated).returning();
    revalidatePath('/customers');
    return { success: true, data: customer };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: 'Failed to create customer' };
  }
}
```
