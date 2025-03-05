import { useState, useRef } from "react";

export default function Home() {
  const [answers, setAnswers] = useState({
    Q1: "",
    Q2: "",
    Q3: [] as string[],
    Q4: "",
  });
  const [response, setResponse] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.Q1 || !answers.Q2 || !answers.Q4) {
      alert("Please answer all required questions.");
      return;
    }
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    });
    const data = await res.json();
    setResponse(JSON.stringify(data, null, 2));
  };

  const toggleFeature = (feature: string) => {
    setAnswers((prev) => ({
      ...prev,
      Q3: prev.Q3.includes(feature)
        ? prev.Q3.filter((f) => f !== feature)
        : [...prev.Q3, feature],
    }));
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Volvo Car Finder</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.question}>
          <h3 style={styles.questionTitle}>How much do you drive daily?</h3>
          <div style={styles.options}>
            {["Less than 20 miles", "20-50 miles", "More than 50 miles"].map((opt, i) => (
              <label key={opt} style={styles.label}>
                <input
                  type="radio"
                  name="Q1"
                  value={i.toString()}
                  checked={answers.Q1 === i.toString()}
                  onChange={(e) => setAnswers({ ...answers, Q1: e.target.value })}
                  style={styles.radio}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div style={styles.question}>
          <h3 style={styles.questionTitle}>What’s your primary usage?</h3>
          <div style={styles.options}>
            {["City commuting", "Family trips", "Outdoor adventures"].map((opt, i) => (
              <label key={opt} style={styles.label}>
                <input
                  type="radio"
                  name="Q2"
                  value={i.toString()}
                  checked={answers.Q2 === i.toString()}
                  onChange={(e) => setAnswers({ ...answers, Q2: e.target.value })}
                  style={styles.radio}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div style={styles.question}>
          <h3 style={styles.questionTitle}>What features matter to you? <span style={styles.subtitle}>(Select all that apply)</span></h3>
          <div style={styles.options}>
            {[
              "Sustainability (e.g., electric/hybrid)",
              "Luxury and comfort",
              "Advanced safety features",
              "Spacious interior",
              "Cutting-edge technology",
              "All-weather performance",
            ].map((opt, i) => (
              <label key={opt} style={styles.label}>
                <input
                  type="checkbox"
                  value={i.toString()}
                  checked={answers.Q3.includes(i.toString())}
                  onChange={() => toggleFeature(i.toString())}
                  style={styles.checkbox}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div style={styles.question}>
          <h3 style={styles.questionTitle}>What style do you prefer?</h3>
          <div style={styles.options}>
            {["Sedan", "SUV/Crossover", "Wagon"].map((opt, i) => (
              <label key={opt} style={styles.label}>
                <input
                  type="radio"
                  name="Q4"
                  value={i.toString()}
                  checked={answers.Q4 === i.toString()}
                  onChange={(e) => setAnswers({ ...answers, Q4: e.target.value })}
                  style={styles.radio}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" style={styles.button}>Find My Volvo</button>
      </form>

      {response && (
        <div style={styles.response}>
          <h3 style={styles.responseTitle}>Your Recommended Volvo</h3>
          <div style={styles.focusedModel}>
            <h4 style={styles.focusedTitle}>Selected: {JSON.parse(response).recommendation}</h4>
            <ChatBox model={JSON.parse(response).recommendation} />
          </div>
          <details style={styles.details}>
            <summary>View Details</summary>
            <pre style={styles.pre}>{response}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ChatBox({ model }: { model: string }) {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<{ type: "question" | "answer"; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const handleAsk = () => {
    if (!question) return;
    setChatHistory((prev) => [...prev, { type: "question", text: question }]);
    setIsLoading(true);
    const source = new EventSource(
      `/api/ask?model=${encodeURIComponent(model)}&q=${encodeURIComponent(question)}`
    );
    let answer = "";
    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.done) {
        source.close();
      } else if (data.text) {
        setIsLoading(false);
        answer += data.text;
        setChatHistory((prev) => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.type === "answer") {
            updated[updated.length - 1].text = answer;
          } else {
            updated.push({ type: "answer", text: answer });
          }
          return updated;
        });
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      } else if (data.error) {
        setChatHistory((prev) => [...prev, { type: "answer", text: `Error: ${data.error}` }]);
        setIsLoading(false);
        source.close();
      }
    };
    source.onerror = () => {
      setChatHistory((prev) => [...prev, { type: "answer", text: answer + "\n[Connection closed]" }]);
      setIsLoading(false);
      source.close();
    };
    setQuestion("");
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.inputRow}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask about ${model} (e.g., colors, horsepower)`}
          style={styles.questionInput}
        />
        <button onClick={handleAsk} style={styles.askButton}>
          Ask
        </button>
      </div>
      {chatHistory.length > 0 && (
        <div style={styles.chatHistory} ref={chatRef}>
          {chatHistory.map((entry, index) => (
            <div
              key={index}
              style={{
                ...styles.chatEntry,
                ...(entry.type === "question" ? styles.questionEntry : styles.answerEntry),
              }}
            >
              {entry.text}
            </div>
          ))}
          {isLoading && <div style={styles.loading}>⏳ Loading...</div>}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    color: "#333",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: 700,
    textAlign: "center" as const,
    marginBottom: "40px",
    color: "#003087",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "30px",
  },
  question: {
    backgroundColor: "#f9f9f9",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  questionTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "15px",
    color: "#222",
  },
  subtitle: {
    fontSize: "0.9rem",
    fontWeight: 400,
    color: "#666",
  },
  options: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  label: {
    display: "flex",
    alignItems: "center",
    fontSize: "1rem",
    cursor: "pointer",
  },
  radio: {
    marginRight: "10px",
    accentColor: "#003087",
  },
  checkbox: {
    marginRight: "10px",
    accentColor: "#003087",
  },
  button: {
    padding: "12px 24px",
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#003087",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    alignSelf: "center" as const,
    transition: "background-color 0.2s",
  },
  response: {
    marginTop: "40px",
    padding: "20px",
    backgroundColor: "#f0f0f0",
    borderRadius: "8px",
  },
  responseTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "20px",
  },
  focusedModel: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  focusedTitle: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#003087",
    marginBottom: "15px",
  },
  details: {
    marginTop: "20px",
  },
  pre: {
    fontSize: "0.9rem",
    color: "#333",
    backgroundColor: "#fff",
    padding: "10px",
    borderRadius: "4px",
    overflowX: "auto" as const,
  },
  chatContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  chatHistory: {
    maxHeight: "300px",
    overflowY: "auto" as const,
    padding: "10px",
    backgroundColor: "#f9f9f9",
    borderRadius: "4px",
    border: "1px solid #ddd",
    display: "flex",
    flexDirection: "column" as const,
  },
  chatEntry: {
    marginBottom: "10px",
    padding: "8px",
    borderRadius: "4px",
    maxWidth: "70%",
  },
  questionEntry: {
    alignSelf: "flex-end" as const,
    backgroundColor: "#e6f0ff",
    textAlign: "right" as const,
  },
  answerEntry: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#fff",
    border: "1px solid #eee",
    textAlign: "left" as const,
  },
  loading: {
    fontSize: "0.9rem",
    color: "#666",
    alignSelf: "flex-start" as const,
    marginTop: "5px",
  },
  inputRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  questionInput: {
    padding: "8px",
    fontSize: "1rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    flexGrow: 1,
  },
  askButton: {
    padding: "8px 16px",
    fontSize: "0.9rem",
    color: "#fff",
    backgroundColor: "#003087",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
