'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';

const SEVERITY_COLORS: Record<string, string> = {
    Critical: 'danger', High: 'warning', Medium: 'info', Low: 'muted',
};

const SEVERITY_ORDER: Record<string, number> = {
    Critical: 0, High: 1, Medium: 2, Low: 3,
};

export default function Defects() {
    const { state } = useApp();
    const [filterSeverity, setFilterSeverity] = useState('');
    const [filterRun, setFilterRun] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [expandedBugId, setExpandedBugId] = useState<string | null>(null);

    // Combine global bugs + embedded bugs from execution runs (backward compat)
    const allBugs = useMemo(() => {
        const result: {
            bugId: string;
            title: string;
            severity: string;
            url: string;
            description: string;
            status: string;
            tcId: string;
            tcTitle: string;
            runId: string;
            runName: string;
            executedBy: string;
            executedAt: string;
        }[] = [];

        const seenIds = new Set<string>();

        state.executionRuns.forEach(run => {
            Object.entries(run.results).forEach(([tcId, res]) => {
                if (res.bug) {
                    seenIds.add(res.bug.bugId);
                    const tc = state.testCases.find(t => t.id === tcId);
                    result.push({
                        bugId: res.bug.bugId,
                        title: res.bug.title,
                        severity: res.bug.severity,
                        url: res.bug.url || '',
                        description: res.bug.description || '',
                        status: 'Open',
                        tcId: tc?.tcId || tcId,
                        tcTitle: tc?.title || '(Deleted TC)',
                        runId: run.id,
                        runName: run.name,
                        executedBy: res.executedBy || '—',
                        executedAt: res.executedAt || '',
                    });
                }
            });
        });

        state.bugs.forEach(b => {
            if (!seenIds.has(b.bugId)) {
                seenIds.add(b.bugId);
                const tc = state.testCases.find(t => t.id === b.tcId);
                result.push({
                    bugId: b.bugId,
                    title: b.title,
                    severity: b.severity,
                    url: b.url || '',
                    description: b.description || '',
                    status: b.status,
                    tcId: tc?.tcId || b.tcId || '—',
                    tcTitle: tc?.title || '—',
                    runId: b.runId || '',
                    runName: b.runId ? state.executionRuns.find(r => r.id === b.runId)?.name || '—' : '—',
                    executedBy: b.createdBy,
                    executedAt: b.createdAt,
                });
            }
        });

        return result.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    }, [state.executionRuns, state.testCases, state.bugs]);

    const filteredBugs = useMemo(() => {
        return allBugs.filter(b => {
            if (filterSeverity && b.severity !== filterSeverity) return false;
            if (filterRun && b.runId !== filterRun) return false;
            if (searchQ) {
                const q = searchQ.toLowerCase();
                if (!b.title.toLowerCase().includes(q) &&
                    !b.bugId.toLowerCase().includes(q) &&
                    !b.tcTitle.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [allBugs, filterSeverity, filterRun, searchQ]);

    const severityCounts = useMemo(() => {
        const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        allBugs.forEach(b => { counts[b.severity] = (counts[b.severity] || 0) + 1; });
        return counts;
    }, [allBugs]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">🐛 Defect Tracker</div>
                    <div className="page-subtitle">All bugs linked from failed test executions</div>
                </div>
                <div className="page-header-actions">
                    {allBugs.length > 0 && (
                        <button className="btn btn-outline" onClick={() => {
                            const rows = filteredBugs.map(b =>
                                [b.bugId, `"${b.title}"`, b.severity, b.tcId, `"${b.tcTitle}"`, b.runName, b.executedBy, b.executedAt, b.url].join(',')
                            );
                            const csv = [['Bug ID', 'Title', 'Severity', 'TC ID', 'TC Title', 'Run', 'Reported By', 'Date', 'URL'], ...rows].map(r => Array.isArray(r) ? r.join(',') : r).join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'defects.csv'; a.click();
                        }}>📥 Export CSV</button>
                    )}
                </div>
            </div>

            {/* Severity Summary Cards */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
                {['Critical', 'High', 'Medium', 'Low'].map(sev => (
                    <div key={sev} className="stat-card" style={{
                        cursor: 'pointer',
                        border: filterSeverity === sev ? `1px solid var(--color-${SEVERITY_COLORS[sev] === 'muted' ? 'border' : SEVERITY_COLORS[sev] === 'info' ? 'info' : SEVERITY_COLORS[sev] === 'warning' ? 'warning' : 'danger'})` : undefined,
                        opacity: filterSeverity && filterSeverity !== sev ? 0.5 : 1,
                        '--stat-color': sev === 'Critical' ? '#ef4444' : sev === 'High' ? '#f59e0b' : sev === 'Medium' ? '#06b6d4' : '#475569',
                    } as React.CSSProperties}
                        onClick={() => setFilterSeverity(filterSeverity === sev ? '' : sev)}>
                        <div className="stat-icon" style={{
                            background: sev === 'Critical' ? 'rgba(239,68,68,0.15)' : sev === 'High' ? 'rgba(245,158,11,0.15)' : sev === 'Medium' ? 'rgba(6,182,212,0.15)' : 'rgba(71,85,105,0.15)'
                        }}>
                            <span style={{ fontSize: 18 }}>{sev === 'Critical' ? '🔴' : sev === 'High' ? '🟠' : sev === 'Medium' ? '🔵' : '⚪'}</span>
                        </div>
                        <div className="stat-value" style={{ fontSize: 28 }}>{severityCounts[sev]}</div>
                        <div className="stat-label">{sev}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="form-input"
                        style={{ maxWidth: 300, flex: 1 }}
                        placeholder="🔍 Search by bug ID, title, or test case..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                    <select className="form-select" style={{ maxWidth: 160 }} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                        <option value="">All Severities</option>
                        {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="form-select" style={{ maxWidth: 220 }} value={filterRun} onChange={e => setFilterRun(e.target.value)}>
                        <option value="">All Runs</option>
                        {state.executionRuns.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                        {filteredBugs.length} of {allBugs.length} defects
                    </span>
                </div>
            </div>

            {/* Defect Table */}
            <div className="card" style={{ padding: 0 }}>
                {filteredBugs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                        <div className="empty-state-icon">🎉</div>
                        <div className="empty-state-title">{allBugs.length === 0 ? 'No bugs linked yet' : 'No bugs match your filters'}</div>
                        <div className="empty-state-desc">
                            {allBugs.length === 0
                                ? 'When a test case is marked as Failed during execution, you can link a bug report here.'
                                : 'Try clearing your filters to see all defects.'}
                        </div>
                    </div>
                ) : (
                    <div>
                        {filteredBugs.map((bug, idx) => (
                            <div key={`${bug.bugId}-${idx}`}
                                style={{
                                    borderBottom: idx < filteredBugs.length - 1 ? '1px solid var(--color-border)' : 'none',
                                    padding: '16px 20px',
                                    background: expandedBugId === bug.bugId ? 'rgba(239,68,68,0.04)' : 'transparent',
                                    transition: 'background 0.15s',
                                }}>
                                {/* Header Row */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    <div style={{
                                        width: 4, alignSelf: 'stretch', borderRadius: 4,
                                        background: bug.severity === 'Critical' ? '#ef4444' : bug.severity === 'High' ? '#f59e0b' : bug.severity === 'Medium' ? '#06b6d4' : '#475569',
                                        flexShrink: 0, minHeight: 40,
                                    }} />

                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--color-danger)', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                                                🐛 {bug.bugId}
                                            </span>
                                            <span className={`badge badge-${SEVERITY_COLORS[bug.severity]}`}>{bug.severity}</span>
                                            <span className={`badge badge-${bug.status === 'Resolved' || bug.status === 'Closed' ? 'success' : bug.status === 'In Progress' ? 'warning' : 'muted'}`} style={{ fontSize: 10 }}>{bug.status}</span>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>{bug.title}</span>
                                        </div>

                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                            <span>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>📋 TC:</span>{' '}
                                                <span style={{ fontFamily: 'monospace' }}>{bug.tcId}</span> — {bug.tcTitle}
                                            </span>
                                            <span>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>▶️ Run:</span> {bug.runName}
                                            </span>
                                            <span>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>👤</span> {bug.executedBy}
                                            </span>
                                            {bug.executedAt && (
                                                <span>📅 {new Date(bug.executedAt).toLocaleString()}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                                        {bug.url && (
                                            <a href={bug.url} target="_blank" rel="noreferrer"
                                                className="btn btn-outline btn-sm"
                                                style={{ fontSize: 11, textDecoration: 'none' }}>
                                                🔗 Open in Tracker
                                            </a>
                                        )}
                                        {bug.description && (
                                            <button className="btn btn-ghost btn-sm"
                                                onClick={() => setExpandedBugId(expandedBugId === bug.bugId ? null : bug.bugId)}>
                                                {expandedBugId === bug.bugId ? '▲ Hide' : '▼ Details'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Description */}
                                {expandedBugId === bug.bugId && bug.description && (
                                    <div style={{
                                        marginTop: 12, marginLeft: 18,
                                        padding: '12px 16px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 13, color: 'var(--color-text-secondary)',
                                        lineHeight: 1.6,
                                    }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                            Description / Steps to Reproduce
                                        </div>
                                        {bug.description}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
