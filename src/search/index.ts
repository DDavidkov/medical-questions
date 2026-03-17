import { query } from "../db/index.js";
import { generateEmbedding } from "../ingestion/enrich.js";
import { config } from "../config/index.js";

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  answers: { content: string; is_correct: boolean }[];
  explanation: string;
  bloom_level: string;
  keywords: string[];
  specialty: string;
  difficulty: string;
  relevant_exam: string;
  score: number;
}

interface ScoredRow {
  id: string;
  title: string;
  content: string;
  answers: { content: string; is_correct: boolean }[];
  explanation: string;
  bloom_level: string;
  keywords: string[];
  specialty: string;
  difficulty: string;
  relevant_exam: string;
  combined_score: number;
}

interface SearchFilters {
  specialty?: string;
  difficulty?: string;
  bloom_level?: string;
  relevant_exam?: string;
}

function hasFilters(filters?: SearchFilters): boolean {
  return !!(filters?.specialty || filters?.difficulty || filters?.bloom_level || filters?.relevant_exam);
}

function buildFilterConditions(filters: SearchFilters, startIndex: number) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = startIndex;

  if (filters.specialty) {
    conditions.push(`q.specialty ILIKE $${paramIndex}`);
    params.push(`%${filters.specialty}%`);
    paramIndex++;
  }
  if (filters.difficulty) {
    conditions.push(`q.difficulty ILIKE $${paramIndex}`);
    params.push(filters.difficulty);
    paramIndex++;
  }
  if (filters.bloom_level) {
    conditions.push(`q.bloom_level ILIKE $${paramIndex}`);
    params.push(filters.bloom_level);
    paramIndex++;
  }
  if (filters.relevant_exam) {
    conditions.push(`q.relevant_exam ILIKE $${paramIndex}`);
    params.push(`%${filters.relevant_exam}%`);
    paramIndex++;
  }

  return { conditions, params, nextIndex: paramIndex };
}

async function filterOnlySearch(filters: SearchFilters): Promise<SearchResult[]> {
  const { conditions, params } = buildFilterConditions(filters, 1);
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const sql = `
    SELECT id, title, content, answers, explanation, bloom_level, keywords,
           specialty, difficulty, relevant_exam, 1.0 AS combined_score
    FROM questions q
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}::int
  `;
  params.push(config.SEARCH_MAX_RESULTS);

  const result = await query<ScoredRow>(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    answers: row.answers,
    explanation: row.explanation,
    bloom_level: row.bloom_level,
    keywords: row.keywords,
    specialty: row.specialty,
    difficulty: row.difficulty,
    relevant_exam: row.relevant_exam,
    score: row.combined_score,
  }));
}

export async function hybridSearch(
  queryText: string,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  const hasQuery = queryText && queryText.trim().length > 0;
  const hasActiveFilters = hasFilters(filters);

  // Filter-only search: no query text, just filters
  if (!hasQuery && hasActiveFilters) {
    return filterOnlySearch(filters!);
  }

  // No query and no filters — nothing to search
  if (!hasQuery) {
    return [];
  }

  // Hybrid search: query text with optional filters
  const embedding = await generateEmbedding(queryText);

  const conditions: string[] = [];
  const params: unknown[] = [queryText, JSON.stringify(embedding)];
  let paramIndex = 3;

  if (hasActiveFilters) {
    const filterResult = buildFilterConditions(filters!, paramIndex);
    conditions.push(...filterResult.conditions);
    params.push(...filterResult.params);
    paramIndex = filterResult.nextIndex;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    WITH ranked AS (
      SELECT
        q.id,
        q.title,
        q.content,
        q.answers,
        q.explanation,
        q.bloom_level,
        q.keywords,
        q.specialty,
        q.difficulty,
        q.relevant_exam,
        ts_rank(q.search_vector, plainto_tsquery('english', $1)) AS text_rank,
        1 - (q.embedding <=> $2::vector) AS similarity
      FROM questions q
      ${whereClause}
    )
    SELECT *,
      (
        $${paramIndex}::float * (text_rank / GREATEST((SELECT MAX(text_rank) FROM ranked), 0.0001)) +
        $${paramIndex + 1}::float * similarity
      ) AS combined_score
    FROM ranked
    WHERE (
      $${paramIndex}::float * (text_rank / GREATEST((SELECT MAX(text_rank) FROM ranked), 0.0001)) +
      $${paramIndex + 1}::float * similarity
    ) >= $${paramIndex + 2}::float
    OR ${conditions.length > 0 ? "TRUE" : "FALSE"}
    ORDER BY combined_score DESC
    LIMIT $${paramIndex + 3}::int
  `;

  params.push(
    config.SEARCH_LEXICAL_WEIGHT,
    config.SEARCH_SEMANTIC_WEIGHT,
    config.SEARCH_SIMILARITY_THRESHOLD,
    config.SEARCH_MAX_RESULTS
  );

  const result = await query<ScoredRow>(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    answers: row.answers,
    explanation: row.explanation,
    bloom_level: row.bloom_level,
    keywords: row.keywords,
    specialty: row.specialty,
    difficulty: row.difficulty,
    relevant_exam: row.relevant_exam,
    score: row.combined_score,
  }));
}
