import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let readableMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          readableMessage = `${parsed.operationType?.toUpperCase() || 'DATA'} error on ${parsed.path || 'workspace'}: ${parsed.error}`;
        }
      } catch {
        // Keep plain message
      }

      return (
        <div className="min-h-screen bg-[#090C0A] text-[#ECFDF5] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#101512] border border-[#1F2B24] rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#ECFDF5]">Workspace Recovery</h2>
            <p className="text-sm text-[#9CA3AF] leading-relaxed break-words">
              {readableMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-medium bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
