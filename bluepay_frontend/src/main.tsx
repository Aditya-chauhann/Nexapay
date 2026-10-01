import React, { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: "32px", background: "#0b0f19", color: "#f87171", fontFamily: "monospace", minHeight: "100vh", overflow: "auto" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#ef4444", marginBottom: "16px" }}>
            Application Error (Crash Detected):
          </h2>
          <div style={{ background: "#111726", padding: "16px", borderRadius: "8px", border: "1px solid #dc2626" }}>
            <p style={{ fontWeight: "bold", color: "#fca5a5" }}>{this.state.error.name}: {this.state.error.message}</p>
            <pre style={{ marginTop: "12px", whiteSpace: "pre-wrap", color: "#94a3b8", fontSize: "12px" }}>
              {this.state.error.stack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "20px", padding: "8px 16px", background: "#2563eb", color: "#fff", borderRadius: "6px", border: "none", cursor: "pointer" }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
