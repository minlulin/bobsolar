# BOB Solar — Progress Log Part 4: Dashboard, Notifications & Settings

> **Phase 4 — Dashboard Visualization, Notification System & Settings**
> Target: Week 8–9

---

## 4.1 Dashboard — "Energy Flow Canvas"

### 4.1.1 Dashboard Data Server Actions

- [ ] `getDashboardStats()`:
  - [ ] Total revenue (sum of completed projects' actualTotal)
  - [ ] Active projects count (by status)
  - [ ] Pending quotations count (draft + sent)
  - [ ] Accepted quotations this month
  - [ ] Total customers count
  - [ ] Overdue warranty alerts count
  - [ ] Revenue this month vs last month (trend %)
  - [ ] Quotation conversion rate (accepted / total sent)
- [ ] `getDashboardPipeline()`:
  - [ ] Pipeline data for flow visualization:
    - [ ] Total customers → Active quotes → Active projects → Completed
    - [ ] Count and MMK value at each stage
- [ ] `getRecentActivity(limit: 10)`:
  - [ ] Last 10 actions across all entities:
    - [ ] "New quotation QT-2026-0015 created"
    - [ ] "Project PJ-2026-0003 marked as completed"
    - [ ] "Customer U Aung added"
    - [ ] "Warranty alert due for PJ-2026-0001"
  - [ ] Include: action type, description, timestamp, link
- [ ] `getUpcomingAlerts(limit: 5)`:
  - [ ] Next 5 warranty/maintenance alerts due

### 4.1.2 TanStack Query Hooks

- [ ] `useDashboardStats()` — queryKey: `['dashboard', 'stats']`, stale: 60s
- [ ] `useDashboardPipeline()` — queryKey: `['dashboard', 'pipeline']`, stale: 60s
- [ ] `useRecentActivity()` — queryKey: `['dashboard', 'activity']`, stale: 30s
- [ ] `useUpcomingAlerts()` — queryKey: `['dashboard', 'alerts']`, stale: 60s

### 4.1.3 Dashboard Page (`src/app/(dashboard)/page.tsx`)

- [ ] Page title: "Dashboard" (no generic subtitle)
- [ ] Greeting: "Good morning, {userName}" with time-based greeting
- [ ] Layout: CSS Grid, responsive (1 col mobile → 2 col tablet → 3 col desktop)
- [ ] All sections animate in with staggered fade-up

### 4.1.4 Solar System Metrics (`src/components/dashboard/sun-gauge.tsx`)

- [ ] **Central visualization — "Solar Orbit":**
  - [ ] Animated SVG with central glowing sun
  - [ ] 4 orbiting "planets" representing key metrics:
    - [ ] 💰 Revenue (amber planet) — size = relative value
    - [ ] ⚡ Active Projects (emerald planet)
    - [ ] 📋 Pending Quotes (indigo planet)
    - [ ] 🔔 Alerts (red planet, if any overdue)
  - [ ] Each planet shows number label
  - [ ] Hover/tap planet → tooltip with details
  - [ ] Slow orbital rotation animation (CSS keyframes, ~60s cycle)
  - [ ] Pulse glow on sun (ambient)
- [ ] **Alternative (simpler) — Radial Metric Cards:**
  - [ ] If SVG orbit is too complex, fall back to:
  - [ ] Circular progress rings for each metric
  - [ ] Solar gradient fill on progress arcs
  - [ ] Count-up number animation on mount
  - [ ] Trend indicator arrow (↑ green / ↓ red) vs last period

### 4.1.5 Energy Flow Pipeline (`src/components/dashboard/energy-flow.tsx`)

- [ ] **Sankey-style flow diagram:**
  - [ ] Horizontal flow: Customers → Quotations → Projects → Completed
  - [ ] Each node shows count + total MMK value
  - [ ] Connecting paths with width proportional to value
  - [ ] Animated particles flowing along paths (Framer Motion)
  - [ ] Solar gradient colors (amber → emerald → teal)
- [ ] **Implementation approach:**
  - [ ] Custom SVG with animated `<path>` elements
  - [ ] Framer Motion for particle animations along paths
  - [ ] Responsive: horizontal on desktop, vertical on mobile
- [ ] Click on any node → navigates to relevant list page
- [ ] Fallback: if too complex, use a horizontal stepper with connected progress bars

### 4.1.6 Activity Stream (`src/components/dashboard/activity-stream.tsx`)

- [ ] **Timeline layout:**
  - [ ] Vertical line with dots at each event
  - [ ] Each event card:
    - [ ] Action icon (create, update, complete, alert)
    - [ ] Description text with entity links
    - [ ] Relative timestamp ("2 hours ago")
    - [ ] Subtle left border color by type
  - [ ] Staggered fade-in animation (50ms each)
- [ ] "View All" link (future: full activity log page)
- [ ] Auto-refresh every 30s

### 4.1.7 Quick Actions Panel

- [ ] Floating card section:
  - [ ] 3 glowing action cards:
    - [ ] ➕ "New Quote" → `/quotations/new`
    - [ ] 👤 "Add Customer" → customer dialog
    - [ ] 📦 "Update Inventory" → `/inventory`
  - [ ] Cards have glassmorphism effect
  - [ ] Hover: glow intensifies + slight scale up
  - [ ] Solar gradient border on hover

### 4.1.8 Upcoming Alerts Widget

- [ ] Compact card listing next 5 warranty/maintenance alerts
- [ ] Each item: project number, alert type icon, due date, urgency color
- [ ] "View All" link → `/warranty`
- [ ] Pulse animation on overdue items

---

## 4.2 Notification System

### 4.2.1 Notification Server Actions (`src/actions/notification-actions.ts`)

- [ ] `getNotifications(userId, filters?)`:
  - [ ] Filter: unread, all
  - [ ] Order by created_at DESC
  - [ ] Limit: 50 most recent
- [ ] `getUnreadCount(userId)`:
  - [ ] Return count of unread notifications
- [ ] `markAsRead(notificationId)`:
  - [ ] Set `isRead: true`
- [ ] `markAllAsRead(userId)`:
  - [ ] Bulk update all unread → read
- [ ] `deleteNotification(notificationId)`:
  - [ ] Remove from DB
- [ ] `createNotification(data)`:
  - [ ] Internal helper — called by other actions
  - [ ] Creates notification for specified user(s)
  - [ ] Types: `info`, `warning`, `action`
  - [ ] Optional `link` for deep navigation

### 4.2.2 Notification Triggers (integrate into existing actions)

- [ ] **Quotation accepted** → notify all users
- [ ] **Project cost exceeds budget by >10%** → notify admin
- [ ] **Project marked completed** → notify all users
- [ ] **Warranty alert within 7 days** → notify all users
- [ ] **Warranty alert overdue** → notify admin (daily check)
- [ ] **Quotation expiring in 3 days** → notify creator
- [ ] Create scheduled check function (can be a daily Worker cron):
  - [ ] Check expiring quotations → create notifications
  - [ ] Check upcoming warranty alerts → create notifications
  - [ ] Check overdue warranty alerts → create notifications

### 4.2.3 Notification Store (`src/stores/notification-store.ts`)

- [ ] Zustand store:
  - [ ] `unreadCount: number`
  - [ ] `isOpen: boolean` (notification panel)
  - [ ] `setUnreadCount(count)`
  - [ ] `togglePanel()`
  - [ ] `decrementUnread()`

### 4.2.4 TanStack Query Hooks (`src/hooks/use-notifications.ts`)

- [ ] `useNotifications()` — queryKey: `['notifications']`, stale: 15s
- [ ] `useUnreadCount()` — queryKey: `['notifications', 'unread']`, stale: 15s, refetchInterval: 30s
- [ ] `useMarkAsRead()` — mutation + optimistic (decrement count)
- [ ] `useMarkAllAsRead()` — mutation + set count to 0
- [ ] `useDeleteNotification()` — mutation

### 4.2.5 Notification Bell (`src/components/shared/notification-bell.tsx`)

- [ ] Bell icon in top bar
- [ ] Unread count badge:
  - [ ] Red circle with white number
  - [ ] Entrance: scale-up + bounce animation
  - [ ] If 0: badge hidden
  - [ ] If >9: show "9+"
- [ ] Pulse animation on new notification arrival
- [ ] Click → toggles notification panel

### 4.2.6 Notification Panel

- [ ] **Slide-in panel** from right (desktop) or bottom sheet (mobile)
- [ ] Header: "Notifications" + "Mark all as read" button
- [ ] **Notification list:**
  - [ ] Unread: slightly highlighted background
  - [ ] Each item:
    - [ ] Type icon (info=blue, warning=amber, action=emerald)
    - [ ] Title (bold)
    - [ ] Message preview (truncated)
    - [ ] Relative timestamp
    - [ ] Click → navigate to `link` URL + mark as read
  - [ ] Staggered entrance animation
- [ ] Empty state: "No notifications 🎉"
- [ ] "Clear all" option at bottom
- [ ] Close on backdrop click or Escape

### 4.2.7 Notification Toast (`src/components/shared/notification-toast.tsx`)

- [ ] Use Sonner for toast notifications
- [ ] Style toasts to match Solar Flow:
  - [ ] Custom toast component with type-specific icon + color
  - [ ] Slide-in from top-right
  - [ ] Auto-dismiss after 5s
  - [ ] Click → navigate to relevant page
- [ ] Toast on:
  - [ ] CRUD success ("Customer created successfully")
  - [ ] CRUD error ("Failed to save quotation")
  - [ ] Status change ("Quote QT-2026-0001 accepted")

---

## 4.3 Settings Page

### 4.3.1 Settings Page (`src/app/(dashboard)/settings/page.tsx`)

- [ ] **Tabs:**
  - [ ] Company Info
  - [ ] User Management
  - [ ] Preferences

### 4.3.2 Company Info Tab

- [ ] **Company Logo:**
  - [ ] Current logo preview (or placeholder)
  - [ ] Upload button → Vercel Blob upload flow
  - [ ] Logo used in PDF header + login page
- [ ] **Company Details Form:**
  - [ ] Company name
  - [ ] Address (textarea)
  - [ ] Phone number
  - [ ] Email
  - [ ] Tax registration number
  - [ ] Bank name
  - [ ] Bank account number
  - [ ] Bank account holder name
- [ ] Save button → updates `companySettings` table
- [ ] All fields read from / write to `companySettings` key-value table
- [ ] React Hook Form + Zod validation

### 4.3.3 User Management Tab (Admin only)

- [ ] **User list:**
  - [ ] Show all 3 users: name, email, role badge
  - [ ] Edit button per user
- [ ] **Edit User Dialog:**
  - [ ] Name (editable)
  - [ ] Email (editable)
  - [ ] Role selector (admin/staff)
  - [ ] Reset password button → generates temporary password
- [ ] **Add User** (if less than 3):
  - [ ] Name, email, role, initial password
  - [ ] Limit to 3 users total
- [ ] Non-admin users: only see own profile, can change own password

### 4.3.4 Preferences Tab

- [ ] **Theme:** Light / Dark / System toggle (visual selector)
- [ ] **Default tax %** for new quotations
- [ ] **Default warranty alert durations** (months)
- [ ] Save preferences to `localStorage` (client-side)

---

## Part 4 Completion Criteria

- [ ] Dashboard loads with all visualizations
- [ ] Solar orbit / radial metrics display real data with animations
- [ ] Energy flow pipeline shows business pipeline accurately
- [ ] Activity stream shows recent actions
- [ ] Quick actions navigate correctly
- [ ] Notification bell shows unread count
- [ ] Notification panel lists all notifications
- [ ] Mark as read / mark all as read works
- [ ] Notification toasts appear on CRUD operations
- [ ] Auto-generated notifications for key events
- [ ] Settings page saves company info correctly
- [ ] Company logo uploads and reflects in PDFs
- [ ] User management works (admin only)
- [ ] All animations run smoothly at 60fps
- [ ] Dashboard is fully responsive
