# Let's Match — custom community form

A fully custom, mobile-first registration form with a fun Instagram/Bumble/Tinder-inspired visual feel, built for free hosting on GitHub Pages and free response storage in Supabase.

The exact 14 questions from the supplied Google Form screenshots are already built into the project. **There is no Google Forms iframe and no Google Form importer.**

## Included experience

- One question per card
- Progress bar
- Required/optional validation
- Email validation
- Phone-friendly WhatsApp field
- Radio-style involvement choices
- Multi-select skill choices
- Custom text input when `Other` skill is selected
- Required personal-data consent
- Animated success screen
- Responsive mobile/desktop design
- Preview mode before Supabase is configured
- Supabase database storage
- Supabase Auth-protected admin dashboard
- View recent submissions
- Export responses to CSV
- Open/close the public form
- Edit brand name, title and description from Admin

## Exact fields included

1. Email *
2. Your Whatsapp Number
3. Your Name *
4. Current City / Country
5. Who am I *
6. What I'm obsessed with (currently) / building *
7. One thing I can help with: *
8. One thing I'm looking for *
9. Which statement best describes your current involvement?
10. What is your primary domain/skill set? (Select all that apply)
11. Have you been involved in a startup/project before?
12. If yes, provide a startup/project link or description
13. Any Remarks, additional information
14. Personal-data processing consent *

## 1. Preview immediately

Open `index.html` locally or publish the project as-is. Until Supabase is configured, the form runs in **Preview mode** so you can inspect all cards and interactions. Preview submissions are not saved.

## 2. Create a free Supabase project

Create a Supabase project and open **SQL Editor**.

Run:

`supabase/migrations/001_setup.sql`

This creates:

- `app_settings`
- `form_fields`
- `submissions`
- `admin_users`
- Row Level Security policies
- all 14 questions

## 3. Connect the website

In Supabase Dashboard go to **Project Settings → API**.

Open `assets/config.js` and replace:

```js
supabaseUrl: "PASTE_YOUR_SUPABASE_URL",
supabaseKey: "PASTE_YOUR_PUBLISHABLE_OR_ANON_KEY",
```

Use the browser-safe **publishable key** (or legacy anon key). Never put a service-role/secret key in GitHub Pages.

## 4. Create the private admin account

In Supabase:

**Authentication → Users → Add user**

Create an email/password user. Copy the user's UUID and then run in SQL Editor:

```sql
insert into public.admin_users (user_id)
values ('PASTE_THE_AUTH_USER_UUID');
```

Now open `admin.html` and sign in.

The admin dashboard can view responses, export CSV, change page text, and pause/reopen the form.

## 5. Host free on GitHub Pages

1. Create a GitHub repository.
2. Upload all project files, including the `assets` folder.
3. Go to **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

Your public form will be available at the GitHub Pages URL.

## Data/security design

Supabase Row Level Security is enabled:

- Public visitors can read form settings/questions.
- Public visitors can insert a submission.
- Public visitors **cannot read submissions**.
- Only authenticated users listed in `admin_users` can view/export submissions or modify form settings.

The required consent answer is saved with the submission.

## Main files

- `index.html` — public form
- `admin.html` — private admin dashboard
- `assets/form-schema.js` — local preview copy of the exact question schema
- `assets/app.js` — form logic
- `assets/admin.js` — admin dashboard logic
- `assets/style.css` — visual theme
- `assets/config.js` — Supabase connection and fallback branding
- `supabase/migrations/001_setup.sql` — database + security + exact question seed
