import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { config } from "../config/index.js";
import { enrichmentSchema, type Enrichment, type RawQuestion } from "./schema.js";

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const ENRICHMENT_PROMPT = `You are a medical education expert. Analyze the following medical exam question and provide structured metadata.

For each question, determine:
1. **Bloom's Taxonomy Level**: What cognitive level does this question test?
   - Remember: Recall of facts or concepts
   - Understand: Explain ideas or concepts
   - Apply: Use information in new situations
   - Analyze: Draw connections among ideas
   - Evaluate: Justify a decision or course of action
   - Create: Produce new or original work

2. **Keywords**: Extract 3-7 medical entities, concepts, or terms that are relevant to the question but NOT explicitly mentioned in the text. These should help with discoverability.

3. **Specialty**: The primary medical specialty this question belongs to.

4. **Difficulty**: Based on the complexity of reasoning required.
   - Easy: Direct recall or single-step reasoning
   - Medium: Multi-step reasoning or integration of concepts
   - Hard: Complex clinical scenarios requiring synthesis of multiple domains

5. **Relevant Exam**: Which standardized medical exam is this most relevant to (e.g., USMLE Step 1, USMLE Step 2 CK, COMLEX Level 1, PLAB Part 1).`;

export async function enrichQuestion(question: RawQuestion): Promise<Enrichment> {
  const questionText = `
Title: ${question.title}
Question: ${question.content}
Answers: ${question.answers.map((a) => `${a.content} (${a.is_correct ? "correct" : "incorrect"})`).join(", ")}
Explanation: ${question.explanation}`;

  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    temperature: 0.1,
    instructions: ENRICHMENT_PROMPT,
    input: questionText,
    text: {
      format: zodTextFormat(enrichmentSchema, "enrichment"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`LLM returned un-parseable response for question: ${question.title}`);
  }

  return parsed;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim(),
  });

  return response.data[0].embedding;
}
