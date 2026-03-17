-- Up Migration: Create questions table with full-text search and vector embedding

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  answers JSONB NOT NULL,
  explanation TEXT NOT NULL,
  bloom_level TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  specialty TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  relevant_exam TEXT NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', content), 'B') ||
    setweight(to_tsvector('english', explanation), 'C')
  ) STORED,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_search_vector ON questions USING GIN (search_vector);
CREATE INDEX idx_questions_embedding ON questions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX idx_questions_specialty ON questions (specialty);
CREATE INDEX idx_questions_difficulty ON questions (difficulty);
CREATE INDEX idx_questions_bloom_level ON questions (bloom_level);

-- Down Migration
-- DROP TABLE IF EXISTS questions;
