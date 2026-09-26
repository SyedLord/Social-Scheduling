# Supabase backend setup

OmniPost now uses Supabase/PostgreSQL as its persistent backend while keeping the existing Express API contract.

## 1. Create the database

Open the Supabase SQL Editor and run the complete contents of `schema.sql`.

This migration intentionally uses the application's existing string IDs so the frontend/API do not need a data-model rewrite.

## 2. Configure the backend

Set these server-side environment variables for the existing Social Scheduler project:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SB_SECRET_KEY
```

Keep `SUPABASE_SECRET_KEY` server-only. Do not put it in Vite/client environment variables and do not commit it to GitHub.

Existing OAuth and Gemini variables remain unchanged.

## 3. Startup behavior

When both Supabase variables are configured:

- The server loads users, workspaces, licenses, connected accounts, posts, analytics and dispatch logs from Supabase.
- An empty Supabase database is initialized from the app seed.
- The scheduler starts only after the database initialization completes.
- The old committed JSON data store is no longer used.

If Supabase variables are missing, the app falls back to in-memory seed data for local development.

## 4. Important security note

The previous JSON store contained demo credentials and application data. It has been removed from the repository.

For a production deployment, use a fresh Supabase database and rotate any OAuth/API credentials that were previously exposed in a public repository.

## 5. Current auth model

This migration keeps OmniPost's existing Express authentication/API contract to avoid breaking the frontend. Passwords are persisted as scrypt hashes in Supabase rather than plaintext.

A later phase can move user sessions fully to Supabase Auth + JWT/RLS without changing the core database model.


## Existing project status

The project `nyisxskizrgosytrzpwb` was inspected before integration. Existing users and licenses were preserved. The compatibility migration was applied to the existing schema; it did not replace the database.

The existing Supabase Auth users are used for sign-in. New accounts created from OmniPost are also created in Supabase Auth.
