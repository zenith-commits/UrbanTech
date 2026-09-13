import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-[320px] bg-navy-900 border border-rose-500/30 rounded-lg p-6 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-rose-400 text-3xl mb-3">⚠</div>
              <p className="text-rose-400 font-semibold tracking-wide">SUBSYSTEM ERROR</p>
              <p className="text-navy-300 text-sm mt-2 font-mono break-all">{this.state.message}</p>
              <p className="text-navy-500 text-xs mt-3">
                The rest of the dashboard continues running.
              </p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}