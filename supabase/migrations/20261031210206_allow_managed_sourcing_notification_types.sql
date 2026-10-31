-- Allow the notification categories emitted by the managed vehicle sourcing workflow.
-- Without these values, the AFTER INSERT trigger aborts the company's request transaction.
alter table public.platform_notifications
  drop constraint if exists platform_notifications_notification_type_check;

alter table public.platform_notifications
  add constraint platform_notifications_notification_type_check
  check (
    notification_type = any (
      array[
        'general',
        'account',
        'vehicle',
        'payment',
        'request',
        'message',
        'subscription',
        'promotion',
        'system',
        'managed_sourcing_request',
        'managed_sourcing_update'
      ]::text[]
    )
  );
