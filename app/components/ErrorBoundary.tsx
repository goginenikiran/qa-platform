'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ color: 'var(--color-danger)', marginBottom: 8, fontSize: 18 }}>
                        Something went wrong
                    </h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 13, maxWidth: 400, marginBottom: 16, lineHeight: 1.5 }}>
                        {this.state.error?.message || 'An unexpected error occurred while rendering this view.'}
                    </p>
                    <button className="btn btn-primary" onClick={this.handleRetry}>
                        🔄 Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
