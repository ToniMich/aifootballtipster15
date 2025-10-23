-- supabase/migrations/20240101000000_initial_schema.sql

-- This migration script creates the primary table for storing all match predictions.
-- It is executed automatically when you run `supabase db reset`.

-- Create the predictions table
create table predictions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  team_a text not null,
  team_b text not null,
  match_category text default 'men'::text not null,
  -- The 'prediction_data' column stores the detailed JSON response from the Gemini AI.
  -- This flexible structure allows for easy addition of new data points in the future
  -- without needing to alter the table schema.
  prediction_data jsonb,
  -- 'status' tracks the lifecycle of a prediction: from processing, to pending the match result,
  -- to its final outcome. This is crucial for the accuracy tracking feature.
  status text check (status in ('processing', 'pending', 'won', 'lost', 'failed')),
  -- 'tally' is a simple counter to track how many times a prediction for a specific
  -- match has been requested. This helps identify popular matches and saves costs
  -- by not re-generating predictions that already exist.
  tally integer default 1 not null
);

-- Add comments for clarity
comment on table public.predictions is 'Stores AI-generated football match predictions.';
comment on column public.predictions.id is 'Unique identifier for each prediction record.';
comment on column public.predictions.created_at is 'Timestamp of when the prediction was created.';
comment on column public.predictions.team_a is 'Name of the first team (often the home team).';
comment on column public.predictions.team_b is 'Name of the second team (often the away team).';
comment on column public.predictions.match_category is 'Category of the match, e.g., ''men'' or ''women''.';
comment on column public.predictions.prediction_data is 'The full JSONB data object containing the detailed AI analysis.';
comment on column public.predictions.status is 'The current status of the prediction (e.g., pending, won, lost).';
comment on column public.predictions.tally is 'Counter for how many times this match prediction was requested.';

-- Enable Row Level Security (RLS) for the predictions table.
-- This is a critical security measure. By default, it denies all access.
-- We will then create specific policies to allow access where needed.
alter table public.predictions enable row level security;

-- Create a policy that allows public, read-only access to all predictions.
-- This is safe because the table contains no user-specific or sensitive data.
-- Anyone using the public anonymous key can read from this table.
create policy "Allow public read-only access"
on public.predictions for select
using (true);

-- Create a policy that denies all insert, update, or delete operations from the public.
-- This ensures that data can only be modified by server-side processes that use
-- the `service_role_key` (i.e., our Supabase Edge Functions), which bypasses RLS.
-- This is a fallback policy to ensure no accidental writes.
create policy "Deny all write operations"
on public.predictions for all
using (false)
with check (false);