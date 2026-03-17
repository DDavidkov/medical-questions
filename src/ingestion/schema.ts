import { z } from "zod";

export const rawQuestionSchema = z.object({
  title: z.string(),
  content: z.string(),
  answers: z.array(
    z.object({
      content: z.string(),
      is_correct: z.boolean(),
    })
  ),
  explanation: z.string(),
});

export type RawQuestion = z.infer<typeof rawQuestionSchema>;

export const enrichmentSchema = z.object({
  bloom_level: z.enum([
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ]),
  keywords: z
    .array(z.string())
    .min(1)
    .describe(
      "Medical entities or concepts relevant to the question but not explicitly stated in the text"
    ),
  specialty: z.string().describe("Primary medical specialty (e.g., Cardiology, Neurology)"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  relevant_exam: z
    .string()
    .describe(
      "Most relevant standardized exam (e.g., USMLE Step 1, USMLE Step 2 CK). This is an AI-suggested label, not authoritative."
    ),
});

export type Enrichment = z.infer<typeof enrichmentSchema>;
