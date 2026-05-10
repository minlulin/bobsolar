# BOB Solar — Progress Log Part 4: Dashboard, Notifications & Settings

> **Phase 4 — Dashboard Visualization, Notification System & Settings**
> Target: Week 8–9

---

## 4.1 Dashboard — "Energy Flow Canvas"

### 4.1.1 Dashboard Data Server Actions

- [x] `getDashboardStats()`:
  - [x] Total revenue (sum of completed projects' actualTotal)
  - [x] Active projects count (by status)
  - [x] Pending quotations count (draft + sent)
  - [x] Accepted quotations this month
  - [x] Total customers count
  - [x] Overdue warranty alerts count
  - [x] Revenue this month vs last month (trend %)
  - [x] Quotation conversion rate (accepted / total sent)
- [x] `getDashboardPipeline()`:
  - [x] Pipeline data for flow visualization:
    - [x] Total customers → Active quotes → Active projects → Completed
    - [x] Count and MMK value at each stage
- [x] `getRecentActivity(limit: 10)`:
  - [x] Last 10 actions across all entities:
    - [x] "New quotation QT-2026-0015 created"
    - [x] "Project PJ-2026-0003 marked as completed"
    - [x] "Customer U Aung added"
    - [x] "Warranty alert due for PJ-2026-0001"
  - [x] Include: action type, description, timestamp, link
- [x] `getUpcomingAlerts(limit: 5)`:
  - [x] Next 5 warranty/maintenance alerts due

### 4.1.2 TanStack Query Hooks

- [x] `useDashboardStats()` — queryKey: `['dashboard', 'stats']`, stale: 60s
- [x] `useDashboardPipeline()` — queryKey: `['dashboard', 'pipeline']`, stale: 60s
- [x] `useRecentActivity()` — queryKey: `['dashboard', 'activity']`, stale: 30s
- [x] `useUpcomingAlerts()` — queryKey: `['dashboard', 'alerts']`, stale: 60s

### 4.1.3 Dashboard Page (`src/app/(dashboard)/page.tsx`)

- [x] Page title: "Dashboard" (no generic subtitle)
- [x] Greeting: "Good morning, {userName}" with time-based greeting
- [x] Layout: CSS Grid, responsive (1 col mobile → 2 col tablet → 3 col desktop)
- [x] All sections animate in with staggered fade-up

### 4.1.4 Solar System Metrics (`src/components/dashboard/sun-gauge.tsx`)

- [x] **Central visualization — "Solar Orbit":**
  - [x] Animated SVG with central glowing sun
  - [x] 4 orbiting "planets" representing key metrics:
    - [x] 💰 Revenue (amber planet) — size = relative value
    - [x] ⚡ Active Projects (emerald planet)
    - [x] 📋 Pending Quotes (indigo planet)
    - [x] 🔔 Alerts (red planet, if any overdue)
  - [x] Each planet shows number label
  - [x] Hover/tap planet → tooltip with details
  - [x] Slow orbital rotation animation (CSS keyframes, ~60s cycle)
  - [x] Pulse glow on sun (ambient)
- [x] **Alternative (simpler) — Radial Metric Cards:**
  - [x] If SVG orbit is too complex, fall back to:
  - [x] Circular progress rings for each metric
  - [x] Solar gradient fill on progress arcs
  - [x] Count-up number animation on mount
  - [x] Trend indicator arrow (↑ green / ↓ red) vs last period

### 4.1.5 Energy Flow Pipeline (`src/components/dashboard/energy-flow.tsx`)

- [x] **Sankey-style flow diagram:**
  - [x] Horizontal flow: Customers → Quotations → Projects → Completed
  - [x] Each node shows count + total MMK value
  - [x] Connecting paths with width proportional to value
  - [x] Animated particles flowing along paths (Framer Motion)
  - [x] Solar gradient colors (amber → emerald → teal)
- [x] **Implementation approach:**
  - [x] Custom SVG with animated `<path>` elements
  - [x] Framer Motion for particle animations along paths
  - [x] Responsive: horizontal on desktop, vertical on mobile
- [x] Click on any node → navigates to relevant list page
- [x] Fallback: if too complex, use a horizontal stepper with connected progress bars

### 4.1.6 Activity Stream (`src/components/dashboard/activity-stream.tsx`)

- [x] **Timeline layout:**
  - [x] Vertical line with dots at each event
  - [x] Each event card:
    - [x] Action icon (create, update, complete, alert)
    - [x] Description text with entity links
    - [x] Relative timestamp ("2 hours ago")
    - [x] Subtle left border color by type
  - [x] Staggered fade-in animation (50ms each)
- [x] "View All" link (future: full activity log page)
- [x] Auto-refresh every 30s

### 4.1.7 Quick Actions Panel

- [x] Floating card section:
  - [x] 3 glowing action cards:
    - [x] ➕ "New Quote" → `/quotations/new`
    - [x] 👤 "Add Customer" → customer dialog
    - [x] 📦 "Update Inventory" → `/inventory`
  - [x] Cards have glassmorphism effect
  - [x] Hover: glow intensifies + slight scale up
  - [x] Solar gradient border on hover

### 4.1.8 Upcoming Alerts Widget

- [x] Compact card listing next 5 warranty/maintenance alerts
- [x] Each item: project number, alert type icon, due date, urgency color
- [x] "View All" link → `/warranty`
- [x] Pulse animation on overdue items

---

## 4.2 Notification System

### 4.2.1 Notification Server Actions (`src/actions/notification-actions.ts`)

- [x] `getNotifications(userId, filters?)`:
  - [x] Filter: unread, all
  - [x] Order by created_at DESC
  - [x] Limit: 50 most recent
- [x] `getUnreadCount(userId)`:
  - [x] Return count of unread notifications
- [x] `markAsRead(notificationId)`:
  - [x] Set `isRead: true`
- [x] `markAllAsRead(userId)`:
  - [x] Bulk update all unread → read
- [x] `deleteNotification(notificationId)`:
  - [x] Remove from DB
- [x] `createNotification(data)`:
  - [x] Internal helper — called by other actions
  - [x] Creates notification for specified user(s)
  - [x] Types: `info`, `warning`, `action`
  - [x] Optional `link` for deep navigation

### 4.2.2 Notification Triggers (integrate into existing actions)

- [x] **Quotation accepted** → notify all users
- [x] **Project cost exceeds budget by >10%** → notify admin
- [x] **Project marked completed** → notify all users
- [x] **Warranty alert within 7 days** → notify all users
- [x] **Warranty alert overdue** → notify admin (daily check)
- [x] **Quotation expiring in 3 days** → notify creator
- [x] Create scheduled check function (can be a daily Worker cron):
  - [x] Check expiring quotations → create notifications
  - [x] Check upcoming warranty alerts → create notifications
  - [x] Check overdue warranty alerts → create notifications

### 4.2.3 Notification Store (`src/stores/notification-store.ts`)

- [x] Zustand store:
  - [x] `unreadCount: number`
  - [x] `isOpen: boolean` (notification panel)
  - [x] `setUnreadCount(count)`
  - [x] `togglePanel()`
  - [x] `decrementUnread()`

### 4.2.4 TanStack Query Hooks (`src/hooks/use-notifications.ts`)

- [x] `useNotifications()` — queryKey: `['notifications']`, stale: 15s
- [x] `useUnreadCount()` — queryKey: `['notifications', 'unread']`, stale: 15s, refetchInterval: 30s
- [x] `useMarkAsRead()` — mutation + optimistic (decrement count)
- [x] `useMarkAllAsRead()` — mutation + set count to 0
- [x] `useDeleteNotification()` — mutation

### 4.2.5 Notification Bell (`src/components/shared/notification-bell.tsx`)

- [x] Bell icon in top bar
- [x] Unread count badge:
  - [x] Red circle with white number
  - [x] Entrance: scale-up + bounce animation
  - [x] If 0: badge hidden
  - [x] If >9: show "9+"
- [x] Pulse animation on new notification arrival
- [x] Click → toggles notification panel

### 4.2.6 Notification Panel

- [x] **Slide-in panel** from right (desktop) or bottom sheet (mobile)
- [x] Header: "Notifications" + "Mark all as read" button
- [x] **Notification list:**
  - [x] Unread: slightly highlighted background
  - [x] Each item:
    - [x] Type icon (info=blue, warning=amber, action=emerald)
    - [x] Title (bold)
    - [x] Message preview (truncated)
    - [x] Relative timestamp
    - [x] Click → navigate to `link` URL + mark as read
  - [x] Staggered entrance animation
- [x] Empty state: "No notifications 🎉"
- [x] "Clear all" option at bottom
- [x] Close on backdrop click or Escape

### 4.2.7 Notification Toast (`src/components/shared/notification-toast.tsx`)

- [x] Use Sonner for toast notifications
- [x] Style toasts to match Solar Flow:
  - [x] Custom toast component with type-specific icon + color
  - [x] Slide-in from top-right
  - [x] Auto-dismiss after 5s
  - [x] Click → navigate to relevant page
- [x] Toast on:
  - [x] CRUD success ("Customer created successfully")
  - [x] CRUD error ("Failed to save quotation")
  - [x] Status change ("Quote QT-2026-0001 accepted")

---

## 4.3 Settings Page

### 4.3.1 Settings Page (`src/app/(dashboard)/settings/page.tsx`)

- [x] **Tabs:**
  - [x] Company Info
  - [x] User Management
  - [x] Preferences

### 4.3.2 Company Info Tab

- [x] **Company Logo:**
  - [x] Current logo preview (or placeholder)
  - [x] Upload button → Vercel Blob upload flow
  - [x] Logo used in PDF header + login page
- [x] **Company Details Form:**
  - [x] Company name
  - [x] Address (textarea)
  - [x] Phone number
  - [x] Email
  - [x] Tax registration number
  - [x] Bank name
  - [x] Bank account number
  - [x] Bank account holder name
- [x] Save button → updates `companySettings` table
- [x] All fields read from / write to `companySettings` key-value table
- [x] React Hook Form + Zod validation

### 4.3.3 User Management Tab (Admin only)

- [x] **User list:**
  - [x] Show all 3 users: name, email, role badge
  - [x] Edit button per user
- [x] **Edit User Dialog:**
  - [x] Name (editable)
  - [x] Email (editable)
  - [x] Role selector (admin/staff)
  - [x] Reset password button → generates temporary password
- [x] **Add User** (if less than 3):
  - [x] Name, email, role, initial password
  - [x] Limit to 3 users total
- [x] Non-admin users: only see own profile, can change own password

### 4.3.4 Preferences Tab

- [x] **Theme:** Light / Dark / System toggle (visual selector)
- [x] **Default tax %** for new quotations
- [x] **Default warranty alert durations** (months)
- [x] Save preferences to `localStorage` (client-side)

---

## Part 4 Completion Criteria

- [x] Dashboard loads with all visualizations
- [x] Solar orbit / radial metrics display real data with animations
- [x] Energy flow pipeline shows business pipeline accurately
- [x] Activity stream shows recent actions
- [x] Quick actions navigate correctly
- [x] Notification bell shows unread count
- [x] Notification panel lists all notifications
- [x] Mark as read / mark all as read works
- [x] Notification toasts appear on CRUD operations
- [x] Auto-generated notifications for key events
- [x] Settings page saves company info correctly
- [x] Company logo uploads and reflects in PDFs
- [x] User management works (admin only)
- [x] All animations run smoothly at 60fps
- [x] Dashboard is fully responsive
