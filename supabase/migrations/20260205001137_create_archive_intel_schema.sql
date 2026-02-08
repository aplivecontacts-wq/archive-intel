/*
  # Archive Intel Database Schema

  This migration creates the core schema for the Archive Intel application.

  ## New Tables
  
  ### `cases`
  - `id` (uuid, primary key) - Unique identifier for each case
  - `title` (text) - Case title/name
  - `tags` (jsonb) - Array of tags for organization
  - `created_at` (timestamptz) - When the case was created
  
  ### `queries`
  - `id` (uuid, primary key) - Unique identifier for each query
  - `case_id` (uuid, foreign key) - References the parent case
  - `raw_input` (text) - Original search input from user
  - `normalized_input` (text) - Processed/normalized version
  - `input_type` (text) - Type: 'url', 'username', or 'quote'
  - `status` (text) - Query status: 'running' or 'complete'
  - `created_at` (timestamptz) - When the query was created
  
  ### `results`
  - `id` (uuid, primary key) - Unique identifier for each result
  - `query_id` (uuid, foreign key) - References the parent query
  - `source` (text) - Result source: 'wayback', 'search', or 'note'
  - `title` (text) - Result title
  - `url` (text) - Result URL (nullable)
  - `captured_at` (timestamptz) - Capture date for archive results (nullable)
  - `snippet` (text) - Text snippet/preview (nullable)
  - `confidence` (decimal) - Confidence score 0-1
  - `created_at` (timestamptz) - When the result was created
  
  ### `notes`
  - `id` (uuid, primary key) - Unique identifier for each note
  - `query_id` (uuid, foreign key) - References the parent query
  - `content` (text) - Note content
  - `created_at` (timestamptz) - When the note was created
  - `updated_at` (timestamptz) - When the note was last updated

  ## Security
  
  All tables have RLS enabled with policies for public access (auth will be added later).
*/

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create queries table
CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  raw_input text NOT NULL,
  normalized_input text NOT NULL,
  input_type text NOT NULL CHECK (input_type IN ('url', 'username', 'quote')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete')),
  created_at timestamptz DEFAULT now()
);

-- Create results table
CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('wayback', 'search', 'note')),
  title text NOT NULL,
  url text,
  captured_at timestamptz,
  snippet text,
  confidence decimal(3, 2) NOT NULL DEFAULT 0.75,
  created_at timestamptz DEFAULT now()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_queries_case_id ON queries(case_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_query_id ON results(query_id);
CREATE INDEX IF NOT EXISTS idx_notes_query_id ON notes(query_id);

-- Enable RLS on all tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- For MVP, allow public access (auth will be added with Clerk later)
-- These policies will be replaced when authentication is implemented

CREATE POLICY "Allow public read access to cases"
  ON cases FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to cases"
  ON cases FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to cases"
  ON cases FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to cases"
  ON cases FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to queries"
  ON queries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to queries"
  ON queries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to queries"
  ON queries FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to queries"
  ON queries FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to results"
  ON results FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to results"
  ON results FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to results"
  ON results FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to results"
  ON results FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to notes"
  ON notes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to notes"
  ON notes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to notes"
  ON notes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to notes"
  ON notes FOR DELETE
  TO anon, authenticated
  USING (true);