/**
 * Unattended kiosk: any render crash shows a night-sea card and reloads after a few seconds.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  broken: boolean;
}

const RELOAD_MS = 5_000;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { broken: false };
  private timer: number | undefined;

  static getDerivedStateFromError(): State {
    return { broken: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[kiosk] render error", error, info.componentStack);
  }

  componentDidUpdate(_: Props, prev: State): void {
    if (this.state.broken && !prev.broken) {
      this.timer = window.setTimeout(() => location.reload(), RELOAD_MS);
    }
  }

  componentWillUnmount(): void {
    window.clearTimeout(this.timer);
  }

  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <main
        className="k-screen k-screen--night k-offline"
        style={{
          width: 800,
          height: 480,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2b4656",
          boxSizing: "border-box",
          padding: 24,
        }}
        role="alert"
        aria-live="assertive"
      >
        <section className="k-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 className="k-title">Something broke</h1>
          <p className="k-hint">Reloading in a few seconds…</p>
        </section>
      </main>
    );
  }
}
