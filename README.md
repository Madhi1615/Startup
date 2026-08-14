# Swipe-style custom form + Supabase + GitHub Pages

This is the **fully custom** version. The public page does **not** embed Google Forms.

It includes:
- Instagram/Bumble/Tinder-inspired visual energy (without copying their logos or exact UI)
- One-question-at-a-time swipe/card experience
- Progress bar and validation
- Supabase database storage
- Supabase Auth-protected admin dashboard
- Recent response viewer
- CSV export
- Open/close form switch
- Google Form importer Edge Function
- Your supplied Google Form URL is prefilled in the project

## How the exact Google Form questions are imported

Google Forms public pages contain a data structure called `FB_PUBLIC_LOAD_DATA_`. The included Supabase Edge Function fetches the public form, reads that structure, extracts supported questions/options/required flags, then writes them into `form_fields`.

The public website then renders those stored questions using the custom UI. After import, there is **no Google Form iframe** on the public page.

Supported importer/render types:
- Short answer
- Paragraph
- Multiple choice
- Checkboxes
- Dropdown
- Linear scale (best-effort options)
- Date
- Time

Detected but not fully rendered in this starter:
- File upload (requires Supabase Storage or another upload backend)
- Google Forms grids (raw structure is preserved in `raw_data` for extension)

## 1. Create a free Supabase project

Create a Supabase project, then open **SQL Editor** and run:

`supabase/migrations/001_setup.sql`

The SQL enables Row Level Security. Public visitors can read the form schema and insert submissions, but only an approved admin can read submissions.

## 2. Create your admin login

In Supabase Dashboard:

1. Authentication → Users → create/add your admin user (email + password).
2. Copy that user's UUID.
3. Run this in SQL Editor:

```sql
insert into public.admin_users (user_id)
values ('PASTE_YOUR_AUTH_USER_UUID');
```

## 3. Configure the static website

Open `assets/config.js` and paste:
- your Supabase project URL
- your browser-safe **publishable key** (or legacy anon key)

Never put a secret/service-role key in GitHub Pages.

Your Google Form URL is already prefilled:

`https://docs.google.com/forms/d/e/1FAIpQLSeRCN0nskw_dJW_SiMrXmusnB8wfGHPYiWBocSKpcIUi3Qi1g/viewform`

## 4. Deploy the importer Edge Function

With Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy import-google-form
```

The function uses the signed-in admin's JWT and checks the `admin_users` table before importing.

## 5. Import the exact Google Form

Open `admin.html` on your deployed site.

1. Sign in with the admin account.
2. The Google Form URL is prefilled.
3. Click **Import / refresh questions**.
4. The form title, description, questions, options, required flags and supported types are copied into Supabase.
5. Reload `index.html` — your custom form is live.

If the original Google Form changes later, click **Import / refresh questions** again.

## 6. Host free on GitHub Pages

Upload the contents of this folder to a public GitHub repository.

Then:

**Settings → Pages → Deploy from a branch → main → /(root)**

GitHub Pages hosts the static frontend; Supabase stores the data.

## Database security

RLS is enabled by the migration:
- anyone can read public form settings/questions
- anyone can insert a new submission
- public users cannot select/read submissions
- authenticated admins listed in `admin_users` can manage settings/questions and read/export responses

## Important limitation

The Google Form import relies on Google's public-page `FB_PUBLIC_LOAD_DATA_` structure, which is not a stable public API. If Google changes that internal format, the importer may need updating. Once questions are imported, the public custom form itself does not depend on Google Forms.
