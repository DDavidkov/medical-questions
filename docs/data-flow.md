# Data Flow Diagram

## Question Lifecycle: Raw to Index-Ready

```mermaid
sequenceDiagram
    participant JSON as Raw JSON Source
    participant Ingestion as Ingestion Service
    participant Queue as Message Queue *
    participant LLM as OpenAI API
    participant Validate as Schema Validator (Zod)
    participant Embed as Embedding Service
    participant DB as PostgreSQL + pgvector

    JSON->>Ingestion: Read raw questions

    loop For each question
        Ingestion->>Queue: Enqueue question
    end

    loop Async Worker Processing
        Queue->>LLM: Send question for enrichment
        LLM-->>Validate: Return enrichment JSON

        alt Valid Schema
            Validate-->>Embed: Pass enriched question
            Embed->>LLM: Generate embedding (text-embedding-3-small)
            LLM-->>Embed: Return vector (1536 dims)
            Embed->>DB: INSERT enriched question + embedding
        else Invalid Schema
            Validate-->>Queue: Reject — retry with backoff
        end
    end

    Note over Queue,DB: * PoC uses sequential processing.<br/>Production would use SQS/BullMQ for async processing.
```

## Search Query Flow

```mermaid
sequenceDiagram
    participant User as User
    participant UI as React Chat UI
    participant API as Fastify API
    participant Agent as OpenAI Agent
    participant Search as Hybrid Search
    participant DB as PostgreSQL

    User->>UI: "Find me hard cardiology questions"
    UI->>API: POST /api/chat { message, conversationId }
    API->>Agent: Send message + conversation history + tool definitions

    Agent->>Agent: Decide to call search_questions tool
    Agent-->>API: Tool call: search_questions({ query: "hard cardiology questions", filters: { specialty: "Cardiology", difficulty: "Hard" }})

    API->>Search: Execute search

    alt Query + Filters (hybrid)
        par Lexical Search
            Search->>DB: Full-text query (tsvector)
            DB-->>Search: Lexical results + scores
        and Semantic Search
            Search->>DB: Vector similarity query (pgvector)
            DB-->>Search: Semantic results + scores
        end
        Search->>Search: Combine scores + apply threshold
    else Filters only (no query text)
        Search->>DB: Direct filter query (no embedding needed)
        DB-->>Search: All matching rows
    end

    Search-->>API: Ranked results

    API->>Agent: Return tool results
    Agent-->>API: Natural language response with questions
    API-->>UI: Response
    UI-->>User: Display formatted answer
```

## Data Transformation Detail

Shows the shape of data at each stage of the pipeline:

```mermaid
graph LR
    A["Raw Question<br/>title, content<br/>answers, explanation"] -->|"OpenAI Enrichment"| B["Enriched Question<br/>+ bloom_level, keywords<br/>+ specialty, difficulty<br/>+ relevant_exam"]
    B -->|"OpenAI Embedding"| C["Index-Ready Question<br/>+ embedding vector 1536<br/>+ search_vector"]
    C -->|INSERT| D[("PostgreSQL<br/>+ pgvector")]
```

## Notes on Asynchronous Design

The PoC processes questions **sequentially** for simplicity. In a production environment, the pipeline would be fully asynchronous:

1. **Message Queue (SQS / BullMQ)**: Raw questions are enqueued and processed by independent workers. This decouples ingestion from enrichment, allowing the system to handle bursts of incoming data.

2. **Retry with Backoff**: If the LLM returns invalid data or the API is rate-limited, the message returns to the queue with exponential backoff. Dead-letter queues capture messages that fail repeatedly.

3. **Idempotency**: Each question has a unique ID. Workers check for duplicates before inserting, ensuring safe retries without double-indexing.

4. **Concurrency Control**: Multiple workers can process questions in parallel, with configurable concurrency to respect LLM rate limits and manage cost.
