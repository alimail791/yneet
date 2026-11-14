// If a page crashes while rendering, show a way out instead of a blank screen,
// and report the error (lib/errorReport.js).
import { Component } from "react";
import { reportError } from "../lib/errorReport";

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { reportError("render", error, { component: String(info?.componentStack || "").slice(0, 800) }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card" style={{ maxWidth: 440, margin: "60px auto", textAlign: "center", padding: 28 }}>
        <div style={{ fontSize: 34 }} aria-hidden="true">😕</div>
        <h2 style={{ margin: "10px 0 6px" }}>Something went wrong</h2>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 16 }}>We've been told about it. Your test answers are saved — reload to carry on.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn btn-blue" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn btn-outline" onClick={() => { window.location.href = "/"; }}>Home</button>
        </div>
      </div>
    );
  }
}
