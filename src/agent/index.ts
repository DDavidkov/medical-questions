import OpenAI from "openai";
import { config } from "../config/index.js";
import { hybridSearch } from "../search/index.js";
import {ChatCompletionMessageFunctionToolCall} from "openai/resources";

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a helpful medical education assistant. You help students find relevant practice questions for their studies.

When a student asks for questions, use the search_questions tool to find matching questions in the database. You can search by topic, keyword, specialty, difficulty, or exam relevance.

When presenting questions to the student, use this format for each question:

### [Question Title]

**Content:** [question stem]

**Answer Options:**
- A) [option]
- B) [option]
- C) [option]
- D) [option]

**Bloom's Level:** [level] | **Specialty:** [specialty] | **Difficulty:** [difficulty] | **Exam:** [exam]

---

Do not reveal the correct answer unless the student explicitly asks for it.
Keep the metadata line separate from the answer list — never nest it inside the answers.

When the search tool returns results, always present them to the student — even if they are not a perfect match. The search uses semantic similarity, so returned results are the closest matches available. If the results are only loosely related, mention that and present them as "related questions."

Only say you couldn't find questions if the search tool returns an empty array.

Do not make up or invent questions. Only present questions returned by the search tool.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_questions",
      description:
        "Search for medical practice questions using hybrid keyword and semantic search. Returns relevant questions based on the query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query — can be keywords, a topic, or a natural language question",
          },
          specialty: {
            type: "string",
            description: "Filter by medical specialty (e.g., Cardiology, Neurology, Pharmacology)",
          },
          difficulty: {
            type: "string",
            enum: ["Easy", "Medium", "Hard"],
            description: "Filter by difficulty level",
          },
          bloom_level: {
            type: "string",
            enum: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"],
            description: "Filter by Bloom's Taxonomy cognitive level",
          },
          relevant_exam: {
            type: "string",
            description: "Filter by relevant exam (e.g., USMLE Step 1, USMLE Step 2 CK)",
          },
        },
        required: [],
      },
    },
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runAgent(history: ChatMessage[]): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
  ];

  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    temperature: 0.3,
  });

  let choice = response.choices[0];

  while (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
    messages.push(choice.message);

    for (const toolCall of choice.message.tool_calls as ChatCompletionMessageFunctionToolCall[]) {
      if (toolCall.function.name === "search_questions") {
        const args = JSON.parse(toolCall.function.arguments);
        console.log("Agent tool call args:", JSON.stringify(args));
        let toolResult: string;

        try {
          const results = await hybridSearch(args.query, {
            specialty: args.specialty,
            difficulty: args.difficulty,
            bloom_level: args.bloom_level,
            relevant_exam: args.relevant_exam,
          });
          console.log(`Search returned ${results.length} results`);
          toolResult = JSON.stringify(results);
        } catch (err) {
          toolResult = JSON.stringify({ error: "Search failed", message: String(err) });
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      temperature: 0.3,
    });

    choice = response.choices[0];
  }

  return choice.message.content ?? "I'm sorry, I couldn't generate a response.";
}
