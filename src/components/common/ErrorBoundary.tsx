import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Mirage ErrorBoundary] Uncaught runtime exception caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-2xl mx-auto my-8 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[var(--text)] shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">
                {this.props.fallbackTitle || 'Something went wrong rendering this view'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                An unexpected error occurred while processing this module: {this.state.error?.message || 'Unknown render exception'}.
              </p>

              {this.state.errorInfo && (
                <details className="mt-3 text-xs bg-[var(--surface-hover)] p-3 rounded-lg border border-[var(--border)] overflow-x-auto text-[var(--text-secondary)]">
                  <summary className="cursor-pointer font-semibold select-none text-[var(--text)]">
                    View technical details
                  </summary>
                  <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap">
                    {this.state.error?.stack}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex items-center gap-2 pt-3">
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  onClick={() => {
                    this.handleReset();
                    window.location.hash = '#/dashboard';
                    window.dispatchEvent(new CustomEvent('mirage:navigate', { detail: '/dashboard' }));
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
