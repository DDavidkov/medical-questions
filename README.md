# Medical Questions Hybrid Search Engine

A backend system that ingests medical exam questions, enriches them with AI-generated metadata, and exposes them via a hybrid search API (lexical + semantic). Includes a chat interface where an AI agent retrieves questions from the database.

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- OpenAI API key

### Setup

```bash
# 1. Install dependencies
npm install
cd web && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Start database
docker compose up -d

# 4. Run migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/medical_questions \
  npx node-pg-migrate up --migrations-dir migrations --migration-file-language sql

# 5. Ingest sample questions (calls OpenAI to enrich + embed)
npm run ingest
# Use --clear flag to wipe and re-ingest: npm run ingest -- --clear

# 6. Start backend API (port 3000)
npm run dev

# 7. Start frontend (port 5173) — in a separate terminal
cd web && npm run dev
```

Open http://localhost:5173 to use the chat interface.

## Project Structure

```
├── docs/                  # Architecture, data flow, strategic plan
├── data/questions.json    # 10 mock medical questions
├── migrations/            # PostgreSQL migrations (pgvector, tables)
├── src/                   # Backend
│   ├── config/            # Environment config (Zod-validated)
│   ├── db/                # PostgreSQL connection pool
│   ├── ingestion/         # LLM enrichment pipeline + embedding
│   ├── search/            # Hybrid search (lexical + semantic + filters)
│   ├── api/               # Fastify REST routes (search, chat)
│   ├── agent/             # OpenAI tool-calling agent
│   └── server.ts          # Entry point
├── web/                   # React chat UI (Vite + TypeScript)
├── docker-compose.yml     # PostgreSQL + pgvector
└── .env.example           # Environment template
```

## API Endpoints

- `GET /health` — Health check
- `GET /api/search?q=...` — Hybrid search with optional filters (`specialty`, `difficulty`, `bloom_level`, `relevant_exam`)
- `POST /api/chat` — Send message to AI agent (`{ message, conversation_id? }`)
- `GET /api/chat/:id` — Fetch conversation history

## Documentation

- [Architecture & Design](docs/architecture.md) — System diagrams, database schema, technology decision record
- [Data Flow](docs/data-flow.md) — Ingestion pipeline and search query flow
- [Strategic Plan](docs/strategic-plan.md) — Roadmap and risk assessment
- [Original Task](docs/task.md) — Task requirements

## Key Technical Decisions

- **Search**: PostgreSQL + pgvector (single system for both lexical and semantic search)
- **LLM**: OpenAI (`gpt-4o-mini` for enrichment/agent, `text-embedding-3-small` for embeddings)
- **Schema enforcement**: Zod + OpenAI structured outputs
- **Backend**: Fastify with Pino structured logging
- **Frontend**: React with markdown rendering
