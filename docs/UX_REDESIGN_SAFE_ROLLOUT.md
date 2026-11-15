# My Car عربيتي — Safe UX Improvement Rollout

## Goal
Improve clarity, navigation, consistency, accessibility, and responsive behavior without removing, renaming, hiding, or changing existing business capabilities.

## Non-negotiable release rules
1. No production deployment directly from this work branch.
2. Every change must be isolated and reviewable in a Preview deployment first.
3. Preserve existing routes, query parameters, role checks, Supabase queries, mutations, validation, payment states, notifications, and feature entry points.
4. Do not replace a working page or navigation system wholesale. Prefer additive, scoped improvements.
5. Before changing a page, record its existing actions and role visibility. After changing it, verify each action remains reachable and behaves the same.
6. Any uncertain behavior is a blocker, not permission to simplify or remove it.
7. Merge and production deployment require explicit owner approval.

## Initial source audit (main branch)
- The application is a React 19 + TypeScript + Vite application with route/page composition in `src/App.tsx`.
- The main workspace implementation is concentrated in `src/components/WorkspacePage.tsx`; employee, supplier, company, and admin experiences also use dedicated page components.
- The owner experience has a persistent horizontal navigation in `src/App.tsx`.
- Supplier navigation has a shared responsive horizontal navigation in `src/components/SupplierNavigation.tsx` and scoped styles in `src/index.css`.
- Company pages have a separate shared sidebar/top-bar styling system in `src/index.css`.
- `src/index.css` contains multiple accumulated global styling layers and broad selectors. This is a regression risk: avoid global restyling or sweeping selector changes until each affected page has been inventoried.
- The app already has shared brand settings and Arabic RTL presentation. Preserve the My Car عربيتي identity and current brand configuration.

## Work sequence
### Phase 0 — Baseline and inventory
- Map every route to its account role and page component.
- Record all visible actions, forms, filters, status transitions, and navigation destinations.
- Capture desktop, tablet, and mobile baselines for the highest-traffic journeys.
- Identify duplicated headers, confusing labels, dead ends, and inconsistent interaction patterns without changing behavior.

### Phase 1 — Shared navigation and page shell
- Improve consistency of headers, active navigation states, page titles, breadcrumbs/back actions, and mobile navigation affordances.
- Keep every existing destination available to the same roles.
- Avoid changing route strings or authorization logic.

### Phase 2 — High-traffic journeys
Prioritize:
1. Owner: My Vehicles, add vehicle, payment confirmation, My Offers, catalog.
2. Company: vehicle search, rental requests, received offers, subscriptions.
3. Fleet supplier: fleet, company/employee requests, submitted offers, messages.
4. Employee: request creation, offers, messages, account.
5. Admin: review queues, account/vehicle/ad/subscription decisions, communications.

### Phase 3 — Forms, feedback, and accessibility
- Standardize field labels, required/optional cues, validation placement, loading states, success/error feedback, and confirmation for destructive actions.
- Improve keyboard focus, touch targets, contrast, and reduced-motion behavior.
- Preserve all existing validation and submission semantics.

### Phase 4 — Verification and rollout
- Run TypeScript/build checks for every batch.
- Compare route and action inventories before/after.
- Test all role-specific journeys on desktop and mobile in Preview.
- Check console/runtime errors and Supabase authorization behavior.
- Publish only after explicit approval; retain a clear rollback path.

## First audit findings and cautions
- Do not make a one-size-fits-all navigation replacement: owner, supplier, company, employee, and admin currently have different navigation patterns and role-specific destinations.
- Do not hide secondary navigation merely to reduce visual density; first establish grouping and mobile discoverability.
- Do not change broad `main`, `article`, `form`, or utility-class selectors globally without a route-by-route visual regression check.
- No business logic, database schema, RLS policy, payment workflow, or account permissions are in scope for the UX-only workstream unless a separately reviewed defect requires it.

## Definition of done
A UX batch is complete only when its visual improvement is visible in Preview, existing actions remain available to the same roles, route destinations are unchanged, automated build/type checks pass, and the affected journeys have been manually verified on desktop and mobile.
