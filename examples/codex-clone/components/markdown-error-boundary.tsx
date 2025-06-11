"use client";

import React from 'react';

interface MarkdownErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface MarkdownErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class MarkdownErrorBoundary extends React.Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  constructor(props: MarkdownErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MarkdownErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('Markdown rendering error:', error);
    console.error('Error info:', errorInfo);
    
    // Log additional context if available
    if (error.message.includes('unrecognized')) {
      console.error('This appears to be an unrecognized HTML tag error. Check the content being passed to the Markdown component.');
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return this.props.fallback || (
        <div className="border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">Content Rendering Error</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            There was an issue rendering this content. This might be due to unsupported HTML tags in the message.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer">Error Details (Development)</summary>
              <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
