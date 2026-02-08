/*
  # Add category column to results table

  ## Changes
  
  ### Modified Tables
  - `results`
    - Add `category` (text, nullable) - Query category for grouping (e.g., "Basic Search", "Structural Pages", "File-Based Survivors", etc.)

  ## Notes
  
  This column enables grouping of search queries by their discovery strategy:
  - Basic Search: Standard search queries
  - Structural Pages: Archive magnets like press releases, news, reports
  - File-Based Survivors: Documents that outlive web pages (PDFs, DOCs, etc.)
  - External Mentions: Off-site references and citations
  - Time Anchors: Time-based queries for historical context
  - Authority & Oversight: Government and oversight records
*/

-- Add category column to results table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'category'
  ) THEN
    ALTER TABLE results ADD COLUMN category text;
  END IF;
END $$;