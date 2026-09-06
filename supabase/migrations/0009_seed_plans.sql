-- Seed the plan catalog. Prices/entitlements are config, not hardcoded
-- throughout the app — every screen should read from this table.

insert into public.plans (
  code, name, price_monthly, currency,
  max_locations, max_staff, max_customers,
  email_enabled, whatsapp_enabled, sms_enabled, automation_enabled,
  white_label_enabled, custom_domain_enabled, advanced_analytics
) values
  ('STARTER', 'Starter', 149, 'AED', 1, 3, 500, true, false, false, false, false, false, false),
  ('GROWTH', 'Growth', 299, 'AED', 1, 10, 5000, true, true, true, true, false, false, false),
  ('PRO', 'Pro / Multi-location', 599, 'AED', 10, 50, 50000, true, true, true, true, true, true, true)
on conflict (code) do nothing;
