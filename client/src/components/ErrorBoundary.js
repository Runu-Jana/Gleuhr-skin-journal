import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and/or error reporting service
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // You can also log to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    // Increment retry count and reset error state
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      const maxRetries = this.props.maxRetries || 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h1>
            
            <p className="text-gray-600 mb-6">
              {this.props.fallbackMessage || 
               'An unexpected error occurred. Please try refreshing the page.'}
            </p>

            {this.props.showErrorDetails && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Error Details
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto max-h-32">
                  <p className="font-mono">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-[#c44033] text-white rounded-lg hover:bg-[#b3382b] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Refresh Page
              </button>
            </div>

            {this.props.showSupport && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  If the problem persists, please contact support at{' '}
                  <a href="mailto:support@gleuhr.com" className="text-[#c44033] hover:underline">
                    support@gleuhr.com
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different parts of the app
export const AppErrorBoundary = (props) => (
  <ErrorBoundary 
    {...props}
    fallbackMessage="The application encountered an error. Please refresh the page to continue."
    showErrorDetails={process.env.NODE_ENV === 'development'}
    showSupport={true}
  />
);

export const RouteErrorBoundary = (props) => (
  <ErrorBoundary 
    {...props}
    fallbackMessage="This page encountered an error. Please try again or navigate to a different page."
    showErrorDetails={false}
    showSupport={false}
    maxRetries={2}
  />
);

export const ComponentErrorBoundary = (props) => (
  <ErrorBoundary 
    {...props}
    fallbackMessage="This component encountered an error. Please try refreshing the page."
    showErrorDetails={false}
    showSupport={false}
    maxRetries={1}
  />
);

export default ErrorBoundary;
