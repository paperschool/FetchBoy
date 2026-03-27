import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.fallbackLabel ? `: ${this.props.fallbackLabel}` : ''}]`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
          <p className="text-red-400 text-sm font-medium">
            {this.props.fallbackLabel ?? 'This section'} encountered an error
          </p>
          <p className="text-app-muted text-xs max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-3 py-1.5 text-xs font-medium rounded border border-app-subtle text-app-secondary hover:bg-app-subtle transition-colors cursor-pointer"
          >
            Reload Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
