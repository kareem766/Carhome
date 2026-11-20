-- A suspended account can have only one active review request at a time.
-- Resolved and closed requests do not block a future review.
create unique index if not exists public_support_requests_one_active_account_review_idx
  on public.public_support_requests (lower(account_email))
  where status in ('open', 'in_progress');
