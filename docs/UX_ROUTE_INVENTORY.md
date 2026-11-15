# My Car عربيتي — UX Route Inventory (baseline)

This is a route-name inventory extracted from the current `src/App.tsx` on `main`. It is a navigation audit starting point, not a claim that every route has been functionally tested. Role guards and query-parameter behavior must be confirmed in the route branches before any page is changed.

## Public and shared
- `/` — public home
- `/privacy` — privacy page
- `/terms` — terms page
- `/support` — support center
- `/services` — automotive services
- `/services/provider/register` — service provider registration
- `/workspace/catalog` — vehicle catalog
- `/workspace/advertising-plans` — advertising plans
- `/messages` — shared messaging
- `/assistant` — My Car assistant

## Owner-related destinations
- `/workspace/owner`
- `/workspace/owner/vehicles`
- `/workspace/owner/offers`
- `/workspace/owner/employee-requests`
- `/workspace/provider-employee-requests` — shared provider-side employee request destination; verify role visibility
- `/workspace/notifications`

## Company-related destinations
- `/workspace/company`
- `/workspace/company/team`
- `/workspace/company/subscriptions`
- `/workspace/company/insights`
- `/workspace/company/alerts`
- `/workspace/company/managed-sourcing`

## Fleet supplier / provider destinations
- `/workspace/supplier`
- `/workspace/supplier/vehicles`
- `/workspace/supplier/insights`
- `/workspace/supplier/employee-requests`
- `/workspace/provider/managed-sourcing`
- `/workspace/provider/employee-messages`

## Employee destinations
- `/workspace/employee`
- `/workspace/employee/messages`
- `/workspace/employee/account`
- `/workspace/employee/requests`

## Admin destinations
- `/workspace/admin`
- `/workspace/admin/support`
- `/workspace/admin/employee-requests`
- `/workspace/admin/managed-sourcing-center`
- `/workspace/admin/managed-sourcing`
- `/workspace/admin/platform-settings`
- `/workspace/admin/managed-accounts`
- `/workspace/admin/payment-information`
- `/workspace/admin/subscription-plans`
- `/workspace/admin/company-subscriptions`
- `/workspace/admin/discount-codes`
- `/workspace/admin/advertising-plans`
- `/workspace/admin/communications`
- `/workspace/admin/automation-review`
- `/workspace/admin/analytics`
- `/workspace/admin/vehicle-reviews`


## Navigation destinations confirmed during the follow-up audit
- Owner persistent navigation: `/workspace/owner/vehicles`, `/workspace/owner/offers`, `/workspace/catalog` (read-only catalog for owners), `/services`, `/workspace/advertising-plans`, `/messages`, `/workspace/provider-employee-requests`, and `/assistant`.
- Supplier navigation: `/workspace/supplier/vehicles`, `/workspace/supplier/requests`, `/workspace/provider-employee-requests`, `/workspace/supplier/offers`, `/workspace/provider/managed-sourcing`, `/workspace/supplier/insights`, `/workspace/catalog`, `/workspace/advertising-plans`, `/messages`, `/services`, and `/workspace/notifications`.
- `/workspace/supplier/requests` and `/workspace/supplier/offers` are resolved by the supplier workspace fallback in `src/App.tsx` and are therefore easy to miss in a route list based only on exact-match conditions.
- `/automotive-services` is an alias for `/services`.
- Navigation visibility is not an authorization boundary. The destination page and its data access must continue to enforce the account role and Supabase policies.

## Verification still required
For every destination above, inspect the corresponding route condition and component to record:
- allowed account role(s) and any admin override;
- redirect behavior when logged out or unauthorized;
- query parameters that open a specific request, offer, conversation, or tab;
- actions/forms/filters/status changes exposed on the page;
- links that lead into or out of the page;
- mobile and desktop navigation entry points.

## Change-control note
This inventory must be updated before a route is renamed, removed, hidden, consolidated, or moved. A route being absent from a navigation bar does not mean it is safe to delete.
