Next.js Application Pre-Production Audit Report
1. Logic Failures
Issue 1: Inconsistent User Role Validation
Location: src/lib/auth/validate.ts lines 49-55 (requireFinanceAccess) Description: The requireFinanceAccess function incorrectly checks for admin role only (auth.role !== "admin"), but finance access might be needed by other roles (e.g., finance team, accountants). This creates a logic flaw where non-admin users who should have finance access are denied. Recommendation: Implement proper role-based access control that checks for specific finance-related roles or permissions rather than hardcoding to admin only.

Issue 2: Session Validation Race Condition Potential
Location: src/lib/auth/session.ts lines 211-250 (getSessionAndRefresh) Description: The session refresh logic has a potential race condition where multiple concurrent requests might all determine that a session needs refreshing (based on the ONE_DAY_MS threshold) and all attempt to refresh and reseal the session simultaneously. Recommendation: Implement a locking mechanism or use atomic database operations to ensure only one refresh operation occurs per session within a given time window.

Issue 3: Incorrect Redirect in Admin/Finance Functions
Location: src/lib/auth/validate.ts lines 41-47 (requireAdmin) and 49-55 (requireFinanceAccess) Description: Both requireAdmin and requireFinanceAccess functions redirect to "/" (home) when access is denied, but they should redirect to an appropriate error page or login page based on the authentication state. Recommendation: Redirect to "/login" when unauthenticated, and to "/unauthorized" or similar when authenticated but lacking permissions.

2. Bugs
Issue 1: Missing Error Boundary for Image Component
Location: src/app\(dashboard)\layout.tsx lines 47-54 (Next.js Image component) Description: The Image component in the dashboard layout uses priority prop but lacks proper error handling. If the image fails to load, it could break the layout or leave a broken image icon. Recommendation: Add onError handler to the Image component or wrap it in an error boundary.

Issue 2: Potential Memory Leak in Theme Provider
Location: src/components/providers.tsx lines 32-62 (ThemeProvider) Description: The ThemeProvider uses useSyncExternalStore with a subscription function that returns undefined (no-op), but doesn't properly clean up subscriptions. While this specific implementation might not leak, the pattern is incorrect. Recommendation: Either remove the useSyncExternalStore call if not needed, or implement proper subscription/unsubscription logic.

Issue 3: Unhandled Promise Rejection in File Upload
Location: src/components/shared/file-upload.tsx lines 50-58 (fetch request) Description: The file upload component makes a fetch request but doesn't handle network errors that might occur before a response is received (e.g., DNS failure, connection reset). Recommendation: Add try/catch around the fetch call itself to handle network-level errors.

Issue 4: Incorrect File Type Validation
Location: src/components/shared/file-upload.tsx line 31 and src/app/api/upload/route.ts line 40 Description: Both client and server validate file types using file.type which can be spoofed. Additionally, the validation array includes "image/webp" but the accepted types list in the input uses "image/webp" (correct) but could benefit from explicit extension validation. Recommendation: Add file extension validation as a secondary check and consider using file content inspection for critical applications.

3. Business Logic Vulnerabilities
Issue 1: Insufficient Input Sanitization for Folder Parameter
Location: src/app/api/upload/route.ts line 31 and src/components/shared/file-upload.tsx line 48 Description: The folder parameter receives minimal sanitization (removing some special characters) but could still be vulnerable to path traversal attacks if the storage implementation doesn't properly validate paths. Recommendation: Implement strict allow-list validation for folder names or use a whitelist of allowed folders.

Issue 2: Missing Rate Limiting on Upload Endpoint
Location: src/app/api/upload/route.ts (entire file) Description: The upload endpoint has no rate limiting, which could allow attackers to upload large files repeatedly, causing storage exhaustion or DoS. Recommendation: Implement rate limiting based on user ID or IP address, especially considering the 5MB file size limit.

Issue 3: Inconsistent Session Validation
Location: src/lib/auth/validate.ts line 23 (getCurrentUser) vs line 33 (requireAuth) Description: getCurrentUser returns null for unauthenticated users while requireAuth throws a redirect. This inconsistency could lead to confusion in components that mix these functions. Recommendation: Document the clear contract difference or consider renaming to make the distinction clearer (e.g., getCurrentUserOrNull vs requireAuth).

Issue 4: Overly Permissive Session Duration
Location: src/lib/domain/policies.ts lines 10-14 (SESSION_TTL_MS) Description: The session TTL is set to 180 days (6 months), which is excessively long for a security-sensitive application like solar installation management. This increases the risk of session hijacking. Recommendation: Reduce session duration to a more secure timeframe (e.g., 7-30 days) with refresh token rotation for long-lived sessions.

4. Performance Bottlenecks
Issue 1: Unnecessary Re-renders in Theme Provider
Location: src/components/providers.tsx lines 56-59 (useMemo in ThemeProvider) Description: The useMemo hook in ThemeProvider recalculates the value object on every render because setTheme is recreated on each render (empty dependency array), causing unnecessary re-renders of consuming components. Recommendation: Move the setTheme function definition outside the component or use useCallback with proper dependencies.

Issue 2: Missing Image Optimization Props
Location: src/app\(dashboard)\layout.tsx line 52 (Image component) Description: The Image component uses unoptimized prop which disables Next.js image optimization, potentially serving larger images than necessary. Recommendation: Remove the unoptimized prop to allow Next.js to optimize images automatically, unless there's a specific reason to disable optimization.

Issue 3: Inefficient Database Query in Dashboard Layout
Location: src/app\(dashboard)\layout.tsx lines 23-29 (user query) Description: The dashboard layout queries the user database on every layout render, which happens on every route change within the dashboard. This could be optimized. Recommendation: Consider caching the user data or moving this data fetching to specific pages that need it rather than the layout.

Issue 4: Missing Suspense Boundaries for Data Fetching
Location: Various components using react-query Description: While react-query is used, there are no visible Suspense boundaries in the code reviewed, which means data fetching might not be leveraging React's concurrent features optimally. Recommendation: Consider implementing Suspense boundaries for better loading state management and concurrent rendering benefits.

Issue 5: Large Bundle Size Risk from Motion Library
Location: src/components/providers.tsx line 4 (motion/react import) Description: The motion library is imported and used with LazyMotion, but if not used extensively throughout the app, it could contribute unnecessarily to bundle size. Recommendation: Audit actual usage of motion animations and consider code-splitting or removing if not essential.

5. UI/UX Bugs
Issue 1: Missing Loading State for Initial Theme Detection
Location: src/components/providers.tsx lines 33-38 (ThemeProvider state initialization) Description: During initial load, there may be a flash of incorrect theme before the saved theme or system preference is applied, especially on slower devices. Recommendation: Consider adding a brief loading state or using useEffect to apply theme after mount to prevent FOUC (Flash of Uncorrect Theme).

Issue 2: Inconsistent Error Messaging
Location: src/components/shared/file-upload.tsx lines 33, 37, 67 (error setting) Description: Error messages are set directly without consistent formatting or translation support, making it difficult to maintain consistent UX or implement i18n. Recommendation: Create a centralized error message system or at least use consistent message formatting.

Issue 3: Accessibility Issue with Skip Link
Location: src/app\(dashboard)\layout.tsx lines 36-41 (Skip to content link) Description: The skip link has appropriate styling but may not receive focus properly in all browser contexts due to the way it's implemented. Recommendation: Test skip link functionality across browsers and consider using a proven accessible skip link pattern.

Issue 4: Missing Focus Trap in Dialogs
Location: Not directly visible in provided snippets, but likely in dialog implementations Description: Dialog components (like those from @radix-ui/react-dialog) should trap focus when open, but this needs verification. Recommendation: Ensure all modal dialogs properly trap focus and return focus to the trigger when closed.

Issue 5: Potential Color Contrast Issues
Location: Cannot determine from code alone, but needs visual testing Description: The theme uses solar colors (--solar) which may not meet WCAG contrast ratios for text on certain backgrounds. Recommendation: Conduct accessibility audit focusing on color contrast ratios, especially for text elements using the solar accent color.

Summary of Critical Issues Requiring Immediate Attention
Session Security: 180-day session duration is excessive for a business application
Access Control: requireFinanceAccess incorrectly restricted to admin only
Upload Security: Missing rate limiting on file upload endpoint
Performance: Theme provider causing unnecessary re-renders
Image Optimization: Unoptimized Image props disabling Next.js optimization
These issues represent the highest risk areas that should be addressed before production release. The session duration and access control issues are particularly concerning from a security perspective, while the performance issues could significantly impact user experience as the application scales.