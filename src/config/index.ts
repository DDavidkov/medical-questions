import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/medical_questions"),
  SEARCH_SIMILARITY_THRESHOLD: z.coerce.number().default(0.5),
  SEARCH_MAX_RESULTS: z.coerce.number().default(5),
  SEARCH_LEXICAL_WEIGHT: z.coerce.number().default(0.4),
  SEARCH_SEMANTIC_WEIGHT: z.coerce.number().default(0.6),
  PORT: z.coerce.number().default(3000),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
