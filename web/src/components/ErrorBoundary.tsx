import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

class ErrorBoundaryBase extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-boundary">
          <h2>Something went wrong loading this page</h2>
          <p className="muted">
            {this.state.error.message || "An unexpected error occurred."} Try reloading, or head back to your overview.
          </p>
          <div className="app-error-actions">
            <button className="btn" type="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn ghost" href="/dashboard">
              Go to Overview
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Resets the boundary whenever the route changes, so navigating away from a broken page recovers automatically. */
export function RouteErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <ErrorBoundaryBase key={location.pathname}>{children}</ErrorBoundaryBase>;
}
