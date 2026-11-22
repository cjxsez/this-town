/**
 * Plain 600x600 black error screen for the ride HUD / games. Any key reloads.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  broken: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { broken: false };

  static getDerivedStateFromError(): State {
    return { broken: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[glasses] render error", error, info.componentStack);
  }

  componentDidUpdate(_: Props, prev: State): void {
    if (this.state.broken && !prev.broken) {
      const reload = () => location.reload();
      window.addEventListener("keydown", reload, { once: true });
    }
  }

  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <main
        className="hud hud-center"
        style={{
          width: 600,
          height: 600,
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div>
          <div className="hud-title">Something broke. Swipe to reload.</div>
          <div className="hud-dim" style={{ marginTop: 12 }}>
            Press any key
          </div>
        </div>
      </main>
    );
  }
}
