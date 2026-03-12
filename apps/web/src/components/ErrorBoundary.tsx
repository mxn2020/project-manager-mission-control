import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: 32,
          background: 'var(--bg-primary, #0f172a)', color: 'var(--text-primary, #e2e8f0)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: 480, textAlign: 'center',
            padding: 32, borderRadius: 12,
            background: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💥</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #94a3b8)', marginBottom: 20 }}>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <pre style={{
              fontSize: 12, textAlign: 'left', padding: 12, borderRadius: 8,
              background: 'var(--bg-primary, #0f172a)', overflow: 'auto', maxHeight: 120,
              color: 'var(--text-tertiary, #64748b)', marginBottom: 20,
            }}>
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: 'var(--accent, #6366f1)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
