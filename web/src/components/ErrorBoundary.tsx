import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * A deploy replaces the hashed route chunks. A tab that was already open still holds the
 * previous index.html, so the next lazy route it visits requests a file that no longer
 * exists and the import rejects. The fix is simply to load the new index.html — but only
 * once, because if the chunk is missing for any other reason a reload loop is worse than
 * an error screen.
 */
const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOAD_FLAG = "agrik_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 30_000;

function recoverFromStaleChunk(error: Error): boolean {
  if (!STALE_CHUNK.test(error.message || "")) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // Private mode and blocked storage both land here. Without somewhere to record the
    // attempt there is no way to guarantee a single reload, so show the error instead.
    return false;
  }
  window.location.reload();
  return true;
}

class ErrorBoundaryBase extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
    recoverFromStaleChunk(error);
  }

  render() {
    if (this.state.error) {
      const stale = STALE_CHUNK.test(this.state.error.message || "");
      return (
        <div className="app-error-boundary">
          <h2>{stale ? "AGRIK was updated" : "Something went wrong loading this page"}</h2>
          <p className="muted">
            {stale
              ? "This page was loaded before the update. Reload to pick up the new version."
              : `${this.state.error.message || "An unexpected error occurred."} Try reloading, or head back to your overview.`}
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
