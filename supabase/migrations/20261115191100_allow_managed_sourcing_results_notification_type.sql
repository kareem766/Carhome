alter table public.platform_notifications
  drop constraint if exists platform_notifications_notification_type_check;

alter table public.platform_notifications
  add constraint platform_notifications_notification_type_check
  check (notification_type = any (array[
    'general','account','vehicle','payment','request','message','subscription','promotion','system',
    'managed_sourcing_request','managed_sourcing_update','managed_sourcing_action',
    'managed_sourcing_subscription','managed_sourcing_subscription_update',
    'managed_sourcing_results','admin_broadcast','marketing'
  ]));
