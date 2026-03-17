import { readFile } from "fs/promises";
import { resolve } from "path";
import { query, closeDatabase } from "../db/index.js";
import { rawQuestionSchema, type RawQuestion } from "./schema.js";
import { enrichQuestion, generateEmbedding } from "./enrich.js";
import { z } from "zod";

const DATA_PATH = resolve(import.meta.dirname, "../../data/questions.json");

async function loadQuestions(): Promise<RawQuestion[]> {
  const raw = await readFile(DATA_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return z.array(rawQuestionSchema).parse(parsed);
}

function buildEmbeddingText(question: RawQuestion, keywords: string[]): string {
  return [
    question.title,
    question.content,
    question.explanation,
    ...keywords,
  ].join(" ");
}

async function ingest(): Promise<void> {
  const logger = console;
  const clearFlag = process.argv.includes("--clear");

  if (clearFlag) {
    logger.info("Clearing existing questions...");
    await query("DELETE FROM questions");
    logger.info("Cleared.");
  }

  const questions = await loadQuestions();
  logger.info(`Loaded ${questions.length} questions from ${DATA_PATH}`);

  let success = 0;
  let failed = 0;

  for (const question of questions) {
    const start = Date.now();
    try {
      logger.info(`Enriching: ${question.title}`);
      const enrichment = await enrichQuestion(question);
      logger.info(`  Bloom's: ${enrichment.bloom_level}, Specialty: ${enrichment.specialty}, Difficulty: ${enrichment.difficulty}`);
      logger.info(`  Keywords: ${enrichment.keywords.join(", ")}`);
      logger.info(`  Relevant Exam: ${enrichment.relevant_exam}`);

      const embeddingText = buildEmbeddingText(question, enrichment.keywords);
      const embedding = await generateEmbedding(embeddingText);

      await query(
        `INSERT INTO questions (title, content, answers, explanation, bloom_level, keywords, specialty, difficulty, relevant_exam, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          question.title,
          question.content,
          JSON.stringify(question.answers),
          question.explanation,
          enrichment.bloom_level,
          enrichment.keywords,
          enrichment.specialty,
          enrichment.difficulty,
          enrichment.relevant_exam,
          JSON.stringify(embedding),
        ]
      );

      const elapsed = Date.now() - start;
      logger.info(`  Indexed in ${elapsed}ms`);
      success++;
    } catch (error) {
      failed++;
      logger.error(`  Failed to process: ${question.title}`, error);
    }
  }

  logger.info(`\nIngestion complete: ${success} succeeded, ${failed} failed out of ${questions.length}`);
  await closeDatabase();
}

ingest().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
