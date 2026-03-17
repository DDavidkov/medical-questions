import { FastifyInstance } from "fastify";
import { query } from "../db/index.js";
import { runAgent } from "../agent/index.js";

interface ChatBody {
  message: string;
  conversation_id?: string;
}

interface ConversationRow {
  id: string;
}

interface MessageRow {
  role: string;
  content: string | null;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatBody }>("/api/chat", async (request, reply) => {
    const { message, conversation_id } = request.body;

    if (!message || message.trim().length === 0) {
      return reply.status(400).send({ error: "Message is required" });
    }

    let conversationId = conversation_id;

    if (!conversationId) {
      const result = await query<ConversationRow>(
        "INSERT INTO conversations DEFAULT VALUES RETURNING id"
      );
      conversationId = result.rows[0].id;
    }

    await query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
      [conversationId, "user", message]
    );

    const historyResult = await query<MessageRow>(
      "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId]
    );

    const history = historyResult.rows.map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content ?? "",
    }));

    const response = await runAgent(history);

    await query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
      [conversationId, "assistant", response]
    );

    await query(
      "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
      [conversationId]
    );

    return { conversation_id: conversationId, response };
  });

  app.get<{ Params: { id: string } }>("/api/chat/:id", async (request, reply) => {
    const { id } = request.params;

    const messages = await query<MessageRow>(
      "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [id]
    );

    if (messages.rows.length === 0) {
      return reply.status(404).send({ error: "Conversation not found" });
    }

    return { conversation_id: id, messages: messages.rows };
  });
}
