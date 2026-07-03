'use client';

import React, { useState } from 'react';
import { useApp } from '../store/AppContext';

const viewTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of your QA platform' },
    integrations: { title: 'Integrations', subtitle: 'Connect to external tools and platforms' },
    requirements: { title: 'Requirements', subtitle: 'Manage and link business requirements' },
    testcases: { title: 'Test Cases', subtitle: 'Create, manage, and organize test cases' },
    folders: { title: 'Releases & Folders', subtitle: 'Organize tests by project, release, and module' },
    execution: { title: 'Test Execution', subtitle: 'Run tests and track results in real-time' },
    reporting: { title: 'Reports & Analytics', subtitle: 'Visualize quality metrics and trends' },
    'ai-generate': { title: 'AI Test Generator', subtitle: 'Generate test cases from requirements using AI' },
    automation: { title: 'Automation Export', subtitle: 'Generate Selenium/Python/Java test automation code' },
    tickets: { title: 'Tickets Linking', subtitle: 'Link external requirements and issue tracking tickets to test cases' },
};

export default function Header() {
    const { state } = useApp();
    const [search, setSearch] = useState('');
    const info = viewTitles[state.activeView] || { title: 'QA Platform', subtitle: '' };

    const now = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return (
        <header className="header">
            <div className="header-left">
                <div>
                    <div className="header-title">{info.title}</div>
                    <div className="header-subtitle">{info.subtitle}</div>
                </div>
            </div>

            <div className="header-right">
                <div className="header-search">
                    <span style={{ opacity: 0.5, fontSize: 14 }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search test cases, requirements..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        id="global-search"
                    />
                </div>

                <div style={{
                    padding: '6px 14px',
                    background: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                }}>
                    📅 {now}
                </div>

                <button className="btn btn-ghost btn-icon" title="Notifications" id="notifications-btn">
                    <span style={{ fontSize: 18 }}>🔔</span>
                </button>
            </div>
        </header>
    );
}
