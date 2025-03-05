import { useState } from "react";

export default function Home() {
  const [answers, setAnswers] = useState({
    Q1: "",
    Q2: "",
    Q3: [] as string[],
    Q4: "",
  });
  const [response, setResponse] = useState<string | null>(null);
  const [focusedModel, setFocusedModel] = useState<string | null>(null);

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
    setFocusedModel(data.recommendations[0]);
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
          <h3 style={styles.responseTitle}>Your Recommended Volvos</h3>
          <div style={styles.recommendationContainer}>
            <div style={styles.modelButtons}>
              {JSON.parse(response).recommendations.map((model: string, index: number) => (
                <button
                  key={model}
                  onClick={() => setFocusedModel(model)}
                  style={{
                    ...styles.modelButton,
                    backgroundColor: focusedModel === model ? "#0044cc" : "#003087",
                    fontWeight: focusedModel === model ? 600 : 400,
                  }}
                >
                  {index + 1}. {model}
                </button>
              ))}
            </div>
            {focusedModel && (
              <div style={styles.focusedModel}>
                <h4 style={styles.focusedTitle}>Selected: {focusedModel}</h4>
                <QuestionInput model={focusedModel} />
              </div>
            )}
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

function QuestionInput({ model }: { model: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const handleAsk = () => {
    if (!question) return;
    setAnswer(""); // Clear previous answer
    const source = new EventSource(
      `/api/ask?model=${encodeURIComponent(model)}&q=${encodeURIComponent(question)}`
    );
    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.done) {
        source.close();
      } else if (data.text) {
        setAnswer((prev) => prev + data.text); // Append each word
      } else if (data.error) {
        setAnswer(`Error: ${data.error}`);
        source.close();
      }
    };
    source.onerror = () => {
      setAnswer((prev) => prev + "\n[Connection closed]");
      source.close();
    };
    setQuestion("");
  };

  return (
    <div style={styles.questionContainer}>
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
      {answer && (
        <div style={styles.answerContainer}>
          <p style={styles.answer}>{answer}</p>
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
  recommendationContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  },
  modelButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  modelButton: {
    padding: "8px 16px",
    fontSize: "1rem",
    color: "#fff",
    backgroundColor: "#003087",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
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
  questionContainer: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
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
  answerContainer: {
    marginTop: "10px",
    padding: "10px",
    backgroundColor: "#f9f9f9",
    borderRadius: "4px",
  },
  answer: {
    fontSize: "1rem",
    color: "#333",
    whiteSpace: "pre-wrap" as const,
    margin: 0,
  },
};
