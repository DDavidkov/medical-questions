import { FastifyInstance } from "fastify";
import { hybridSearch } from "../search/index.js";

interface SearchQuery {
  q: string;
  specialty?: string;
  difficulty?: string;
  bloom_level?: string;
  relevant_exam?: string;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SearchQuery }>("/api/search", async (request, reply) => {
    const { q, specialty, difficulty, bloom_level, relevant_exam } = request.query;

    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: "Query parameter 'q' is required" });
    }

    const results = await hybridSearch(q, {
      specialty,
      difficulty,
      bloom_level,
      relevant_exam,
    });

    return { query: q, count: results.length, results };
  });
}
