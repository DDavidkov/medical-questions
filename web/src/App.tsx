import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = "http://localhost:3000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();
      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const newConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Medical Questions Assistant</h1>
        <button onClick={newConversation} style={styles.newChatBtn}>
          New Chat
        </button>
      </header>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            Ask me to find medical practice questions. Try something like:
            <br />
            <em>"Show me cardiology questions"</em>
            <br />
            <em>"Find USMLE Step 1 questions"</em>
            <br />
            <em>"Questions about heart failure symptoms"</em>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === "user" ? styles.userMessage : styles.assistantMessage),
            }}
          >
            <div style={styles.messageRole}>
              {msg.role === "user" ? "You" : "Assistant"}
            </div>
            <div style={styles.messageContent}>
              {msg.role === "assistant" ? (
                <div className="markdown-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.message, ...styles.assistantMessage }}>
            <div style={styles.messageRole}>Assistant</div>
            <div style={styles.messageContent}>Searching...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about medical questions..."
          style={styles.input}
          rows={2}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} style={styles.sendBtn}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: 800,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #e0e0e0",
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  newChatBtn: {
    padding: "8px 16px",
    border: "1px solid #ccc",
    borderRadius: 6,
    background: "white",
    cursor: "pointer",
    fontSize: 14,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 20,
  },
  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 60,
    lineHeight: 2,
  },
  message: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 8,
    maxWidth: "85%",
  },
  userMessage: {
    background: "#e8f0fe",
    marginLeft: "auto",
  },
  assistantMessage: {
    background: "#f5f5f5",
    marginRight: "auto",
  },
  messageRole: {
    fontSize: 12,
    fontWeight: 600,
    color: "#666",
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 1.6,
  },
  inputArea: {
    display: "flex",
    gap: 10,
    padding: 16,
    borderTop: "1px solid #e0e0e0",
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 14,
    resize: "none",
    fontFamily: "inherit",
  },
  sendBtn: {
    padding: "12px 24px",
    borderRadius: 8,
    border: "none",
    background: "#1a73e8",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    alignSelf: "flex-end",
  },
};

export default App;
