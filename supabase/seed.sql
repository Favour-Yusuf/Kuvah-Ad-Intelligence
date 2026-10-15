-- Optional demo data for a development project. All brands and copy are fictional.
-- Run after migrations and after at least one team member exists:
--   the rows are attributed to the first admin.

do $$
declare
  owner uuid;
  c uuid;
begin
  select user_id into owner from public.team_members where role = 'admin' order by created_at limit 1;
  if owner is null then
    raise exception 'Add a team admin before seeding (see README).';
  end if;

  insert into public.ads
    (created_by, source_url, brand, platform, target_country, industry, format, headline, ad_copy,
     creative_description, cta, observed_at, research_notes, marketing_angle)
  values
    (owner, 'https://example.com/demo/lumen-1', 'Demo: Lumen Skin', 'instagram', 'US', 'Beauty', 'video',
     'Your 3-step routine, simplified',
     'Stop guessing which serum goes first. Lumen''s 3-step kit tells you exactly what to use, morning and night. Free shipping over $40.',
     'Vertical video. Opens on a cluttered bathroom shelf, cuts to three labelled bottles, ends on a before/after of the shelf.',
     'Shop now', current_date - 3, 'Strong "simplify" angle; shelf visual is reusable.', 'Simplicity'),
    (owner, 'https://example.com/demo/forge-1', 'Demo: Forge Coffee', 'facebook', 'GB', 'Food & drink', 'image',
     'Barista taste. Two minutes.',
     'Fresh-ground flavour without the machine. Try 6 blends for £9 — cancel anytime.',
     'Single product shot of a pouch next to a steaming mug on a kitchen counter, warm lighting.',
     'Get offer', current_date - 10, null, 'Convenience'),
    (owner, 'https://example.com/demo/stride-1', 'Demo: Stride Run', 'tiktok', 'US', 'Apparel', 'video',
     'I ran 10k in these and forgot I had them on',
     'Creator-style review. "No rubbing, no bounce." 30-day test run: send them back if they are not your favourite pair.',
     'Selfie-style creator video filmed mid-run, text overlays with timestamps, ends on a close-up of the shoe.',
     'Learn more', current_date - 1, 'Creator testimonial format; risk-reversal offer.', 'Social proof');

  insert into public.collections (created_by, name, description)
  values (owner, 'Demo: Hooks to test', 'Openers worth adapting for Q4.')
  returning id into c;

  insert into public.collection_items (collection_id, ad_id, added_by, note)
  select c, id, owner, 'Seeded example' from public.ads where brand like 'Demo:%';
end $$;
