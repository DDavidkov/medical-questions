# Strategic Plan

## Roadmap

### Milestone 1: Foundation & Data Pipeline
**Goal:** Ingest and enrich medical questions with AI-generated metadata.

- Set up project scaffolding (TypeScript, Fastify, Docker Compose)
- Design database schema (PostgreSQL + pgvector)
- Create mock question dataset (5-10 questions)
- Implement LLM enrichment pipeline (Bloom's Taxonomy, keywords, specialty, difficulty, relevant exam)
- Implement structured output validation with Zod
- Generate and store embeddings

### Milestone 2: Hybrid Search Engine
**Goal:** Enable both keyword and semantic retrieval in a single query.

- Implement full-text search using PostgreSQL `tsvector`/`tsquery`
- Implement vector similarity search using pgvector
- Build combined scoring (Reciprocal Rank Fusion) with configurable weights
- Apply combined score threshold filtering (default 0.5, configurable)
- Support filter-only queries (no embedding needed when searching by metadata only)
- Expose REST API endpoint (`GET /api/search`)

### Milestone 3: Chat Agent & UI
**Goal:** Users can find questions through natural language conversation.

- Implement OpenAI tool-calling agent with `search_questions` tool
- Build conversation management with PostgreSQL persistence
- Create React chat UI
- Connect frontend to chat API endpoint
- Handle no-results gracefully (agent suggests rephrasing)

### Milestone 4: Testing & Hardening (Future)
**Goal:** Confidence that the system works correctly and handles edge cases.

- Integration tests for the ingestion pipeline (LLM → validation → DB)
- E2E tests for the search API (keyword queries, semantic queries, hybrid)
- Agent behavior tests (does it call the right tool with the right parameters?)
- Search quality evaluation (relevance of results for known queries)
- Load testing for search endpoint latency under concurrent requests
- Re-indexing mechanism: when enrichment prompts change or embedding models are updated, all existing records must be re-processed. This is critical for maintaining consistency — without it, older questions carry stale metadata and embeddings that diverge from newer ones, silently degrading search quality over time.

### Milestone 5: Production Readiness (Future)
**Goal:** Scale the system for real-world use.

- Migrate search to OpenSearch (or OpenSearch + Pinecone)
- Add message queue for async ingestion (SQS / BullMQ)
- Implement observability stack (OpenTelemetry, Prometheus, Grafana)
- Add authentication and rate limiting to API
- CI/CD pipeline with automated test suite
- Admin interface for subject matter experts to review/override AI labels

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| **LLM Non-Determinism** — Same question may get different classifications across runs | Inconsistent metadata | Structured outputs (Zod validation), low temperature (0.1), constrained enums. Production: evaluate against human-labeled golden set. |
| **AI-Suggested Metadata Accuracy** — Fields like "Relevant Exam" are educated guesses, not authoritative | Student misguidance | Label as "AI-suggested" in UI. Allow SME overrides via admin interface. Surface low-confidence labels for review. |
| **LLM Latency & Cost** — Two API calls per question (enrichment + embedding) | Slow ingestion, high cost at scale | Async queue-based processing, cache results, use cost-efficient models (`gpt-4o-mini`, `text-embedding-3-small`), budget alerts. |
| **Index Drift** — Stale embeddings/metadata as questions accumulate | Degraded search quality | Version enrichment prompts, periodic re-indexing jobs, track search quality metrics (CTR, user feedback). |
| **Search Relevance Tuning** — Hybrid scoring weights may not be optimal out of the box | Poor result ranking | Configurable weights (default 0.4/0.6), evaluation query set, A/B testing in production. |
| **Testing Complexity** — LLM outputs vary, search relevance is subjective | Hard to write deterministic tests | Mock LLM responses for unit tests, integration tests against real DB, search quality tests with known query-result pairs, agent tests on tool selection not response wording. |
