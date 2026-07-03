'use client';

import React from 'react';
import { useApp } from '../store/AppContext';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '⬛', section: 'main' },
    { id: 'integrations', label: 'Integrations', icon: '🔗', section: 'main' },
    { id: 'requirements', label: 'Requirements', icon: '📋', section: 'main' },
    { id: 'tickets', label: 'Tickets Linking', icon: '🎫', section: 'testing' },
    { id: 'testcases', label: 'Test Cases', icon: '✅', section: 'testing' },
    { id: 'folders', label: 'Releases & Folders', icon: '📁', section: 'testing' },
    { id: 'execution', label: 'Test Execution', icon: '▶️', section: 'testing' },
    { id: 'integration', label: 'Integration Runs', icon: '⚡', section: 'testing' },
    { id: 'defects', label: 'Defect Tracker', icon: '🐛', section: 'testing' },
    { id: 'reporting', label: 'Reports & Analytics', icon: '📊', section: 'testing' },
    { id: 'qa-agent', label: 'QA Agent', icon: '🧠', section: 'ai' },
    { id: 'ai-generate', label: 'AI Test Generator', icon: '🤖', section: 'ai' },
    { id: 'automation', label: 'Automation Export', icon: '⚡', section: 'ai' },
    { id: 'teams', label: 'Teams & Access', icon: '🛡️', section: 'main' },
];

const sections = [
    { id: 'main', label: 'Platform' },
    { id: 'testing', label: 'Testing' },
    { id: 'ai', label: 'AI & Automation' },
];

export default function Sidebar() {
    const { state, dispatch } = useApp();

    const visibleFolders = state.folders.filter(f => state.currentUser?.role === 'Admin' || !f.teamId || state.currentUser?.teamIds.includes(f.teamId));
    const visibleFolderIds = visibleFolders.map(f => f.id);
    const visibleTestCasesCount = state.testCases.filter(tc => visibleFolderIds.includes(tc.folderId)).length;

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">🚀</div>
                <div className="sidebar-logo-text">
                    <span className="sidebar-logo-title">QA Copilot</span>
                    <span className="sidebar-logo-subtitle">v1.0</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {sections.map(section => (
                    <div className="sidebar-section" key={section.id}>
                        <div className="sidebar-section-label">{section.label}</div>
                        {navItems
                            .filter(item => item.section === section.id)
                            .map(item => {
                                const isActive = state.activeView === item.id;
                                const badge = item.id === 'testcases' ? visibleTestCasesCount :
                                    item.id === 'folders' ? visibleFolders.length :
                                        item.id === 'tickets' ? state.tickets.length :
                                            item.id === 'defects' ? (state.bugs.length || null) :
                                                item.id === 'execution' ? state.executionRuns.filter(r => r.status === 'In Progress' && !r.isIntegration).length :
                                                    item.id === 'integration' ? state.executionRuns.filter(r => r.status === 'In Progress' && r.isIntegration).length : null;
                                return (
                                    <button
                                        key={item.id}
                                        id={`nav-${item.id}`}
                                        className={`nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => dispatch({ type: 'SET_VIEW', payload: item.id })}
                                    >
                                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
                                        <span>{item.label}</span>
                                        {badge ? <span className="nav-badge">{badge}</span> : null}
                                    </button>
                                );
                            })}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: state.currentUser?.role === 'Admin' ? 'linear-gradient(135deg, #ef4444, #f59e0b)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>{state.currentUser?.name.charAt(0) || 'U'}</div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }} className="truncate">{state.currentUser?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{state.currentUser?.role}</div>
                    </div>
                    <button 
                        onClick={() => dispatch({ type: 'SET_CURRENT_USER', payload: null })}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                        title="Log Out / Switch to Login Gate"
                    >
                        🚪
                    </button>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>Switch User Profile</div>
                    <select className="form-select" style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(0,0,0,0.2)' }}
                        value={state.currentUser?.id || ''}
                        onChange={(e) => {
                            const u = state.users.find(x => x.id === e.target.value);
                            if (u) dispatch({ type: 'SET_CURRENT_USER', payload: u });
                        }}
                    >
                        {state.users.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                </div>
            </div>
        </aside>
    );
}
