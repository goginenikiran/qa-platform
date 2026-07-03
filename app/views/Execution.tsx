'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, ExecutionRun, TestStatus, generateId, getStatusColor, getPriorityColor, calculateRunStats } from '../store/AppContext';

const STATUS_ICONS: Record<TestStatus, string> = {
    'Pass': '✅', 'Fail': '❌', 'Blocked': '⚠️', 'Skipped': '⏭️', 'Not Run': '⬜',
};

interface BugReport {
    bugId: string;
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    url: string;
    description: string;
}

type ExecutionResultEntry = ExecutionRun['results'][string];

export default function Execution() {
    const { state, dispatch } = useApp();
    const [showNewRun, setShowNewRun] = useState(false);
    const [activeRunId, setActiveRunId] = useState<string | null>(state.activeRunId);
    const [runForm, setRunForm] = useState({ name: '', folderId: '', environment: 'Staging', selectedTCs: [] as string[] });
    const [executingTCId, setExecutingTCId] = useState<string | null>(null);
    const [stepResults, setStepResults] = useState<Record<string, string>>({});
    const [comment, setComment] = useState('');
    const [screenshots, setScreenshots] = useState<{ [tcId: string]: string[] }>({});
    const handleScreenshotUpload = (tcId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                setScreenshots(prev => ({ ...prev, [tcId]: [...(prev[tcId] || []), dataUrl] }));
            };
            reader.readAsDataURL(file);
        });
    };
    const removeScreenshot = (tcId: string, idx: number) => {
        setScreenshots(prev => ({ ...prev, [tcId]: (prev[tcId] || []).filter((_, i) => i !== idx) }));
    };

    // Bug association state
    const [showBugModal, setShowBugModal] = useState(false);
    const [pendingFailTCId, setPendingFailTCId] = useState<string | null>(null);
    const [bugForm, setBugForm] = useState<BugReport>({ bugId: '', title: '', severity: 'High', url: '', description: '' });
    const [viewBugTCId, setViewBugTCId] = useState<string | null>(null);

    const activeRun = useMemo(() => state.executionRuns.find(r => r.id === activeRunId), [activeRunId, state.executionRuns]);

    const folderTCs = useMemo(() => {
        if (!runForm.folderId) return [];
        return state.testCases.filter(t => t.folderId === runForm.folderId);
    }, [runForm.folderId, state.testCases]);

    const handleCreateRun = () => {
        if (!runForm.name.trim() || runForm.selectedTCs.length === 0) return;
        const newRun: ExecutionRun = {
            id: generateId(),
            name: runForm.name,
            folderId: runForm.folderId,
            testCases: runForm.selectedTCs,
            results: {},
            startedAt: new Date().toISOString(),
            createdBy: state.currentUser?.name || 'Admin',
            status: 'In Progress',
            environment: runForm.environment,
        };
        dispatch({ type: 'ADD_EXECUTION_RUN', payload: newRun });
        setActiveRunId(newRun.id);
        setShowNewRun(false);
        setRunForm({ name: '', folderId: '', environment: 'Staging', selectedTCs: [] });
    };

    // When marking Fail → open bug modal
    const handleMarkFail = (tcId: string) => {
        setPendingFailTCId(tcId);
        setBugForm({ bugId: '', title: '', severity: 'High', url: '', description: '' });
        setShowBugModal(true);
    };

    const handleSaveBugAndFail = () => {
        if (!activeRun || !pendingFailTCId) return;
        const bugId = bugForm.bugId || `BUG-${generateId().toUpperCase()}`;
        const bugPayload = bugForm.title ? { ...bugForm, bugId } : undefined;
        commitResult(pendingFailTCId, 'Fail', bugPayload);
        setShowBugModal(false);
        setPendingFailTCId(null);
    };

    const handleSkipBugAndFail = () => {
        if (!activeRun || !pendingFailTCId) return;
        commitResult(pendingFailTCId, 'Fail', undefined);
        setShowBugModal(false);
        setPendingFailTCId(null);
    };

    const commitResult = (tcId: string, status: TestStatus, bug?: BugReport & { bugId: string }) => {
        if (!activeRun) return;
        const bugObj = bug ? {
            id: generateId(),
            bugId: bug.bugId,
            title: bug.title,
            severity: bug.severity,
            status: 'Open' as const,
            url: bug.url,
            description: bug.description,
            runId: activeRun.id,
            tcId,
            createdBy: state.currentUser?.name || 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } : undefined;

        const tcScreenshots = screenshots[tcId];
        const resultEntry = {
            status,
            comment: comment || undefined,
            executedAt: new Date().toISOString(),
            executedBy: state.currentUser?.name || 'Admin',
            bug: bugObj,
            screenshotUrls: tcScreenshots?.length ? tcScreenshots : undefined,
        };
        const updated: ExecutionRun = {
            ...activeRun,
            results: { ...activeRun.results, [tcId]: resultEntry },
        };
        const allDone = updated.testCases.every(id => updated.results[id]);
        if (allDone) updated.status = 'Completed';
        dispatch({ type: 'UPDATE_EXECUTION_RUN', payload: updated });
        const tc = state.testCases.find(t => t.id === tcId);
        if (tc) dispatch({ type: 'UPDATE_TEST_CASE', payload: { ...tc, status } });
        // Also add to global bugs store for first-class tracking
        if (bugObj) {
            dispatch({ type: 'ADD_BUG', payload: bugObj });
        }
        setExecutingTCId(null);
        setComment('');
        setStepResults({});
        setScreenshots(prev => { const n = { ...prev }; delete n[tcId]; return n; });
    };

    const handleMarkResult = (tcId: string, status: TestStatus) => {
        if (status === 'Fail') {
            handleMarkFail(tcId);
        } else {
            commitResult(tcId, status);
        }
    };

    const handleAbortRun = () => {
        if (!activeRun || !confirm('Abort this run?')) return;
        dispatch({ type: 'UPDATE_EXECUTION_RUN', payload: { ...activeRun, status: 'Aborted', completedAt: new Date().toISOString() } });
        setActiveRunId(null);
    };

    const toggleTCSelect = (id: string) => {
        const arr = runForm.selectedTCs;
        if (arr.includes(id)) setRunForm({ ...runForm, selectedTCs: arr.filter(x => x !== id) });
        else setRunForm({ ...runForm, selectedTCs: [...arr, id] });
    };

    const selectAllTCs = () => {
        if (runForm.selectedTCs.length === folderTCs.length) setRunForm({ ...runForm, selectedTCs: [] });
        else setRunForm({ ...runForm, selectedTCs: folderTCs.map(t => t.id) });
    };

    const inProgressRuns = state.executionRuns.filter(r => r.status === 'In Progress');

    const SEVERITY_COLORS: Record<string, string> = {
        Critical: 'danger', High: 'warning', Medium: 'info', Low: 'muted'
    };

    const closeBugModal = useCallback(() => {
        setShowBugModal(false);
        setPendingFailTCId(null);
    }, []);

    const closeNewRunModal = useCallback(() => {
        setShowNewRun(false);
    }, []);

    useEffect(() => {
        if (!showBugModal && !showNewRun) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showBugModal) closeBugModal();
                if (showNewRun) closeNewRunModal();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [showBugModal, showNewRun, closeBugModal, closeNewRunModal]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Test Execution</div>
                    <div className="page-subtitle">Run test cases and track results in real-time</div>
                </div>
                <div className="page-header-actions">
                    {activeRun && activeRun.status === 'In Progress' && (
                        <button className="btn btn-danger" onClick={handleAbortRun} id="abort-run-btn">⛔ Abort Run</button>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowNewRun(true)} id="new-run-btn">▶️ New Run</button>
                </div>
            </div>

            {/* In-Progress Runs Banner */}
            {inProgressRuns.length > 0 && (
                <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 'var(--radius-lg)', padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', boxShadow: '0 0 6px var(--color-info)' }} className="animate-pulse" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-info)' }}>{inProgressRuns.length} run(s) in progress</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {inProgressRuns.map(r => (
                            <button key={r.id} className="btn btn-outline btn-sm" onClick={() => setActiveRunId(r.id)}>
                                ▶️ {r.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: activeRun ? '360px 1fr' : '1fr', gap: 20 }}>
                {/* Run List */}
                <div>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-header">
                            <div className="card-title">Execution Runs</div>
                            <span className="badge badge-primary">{state.executionRuns.length}</span>
                        </div>
                        {state.executionRuns.length === 0 ? (
                            <div className="empty-state" style={{ padding: '30px 20px' }}>
                                <div className="empty-state-icon">▶️</div>
                                <div className="empty-state-title">No runs yet</div>
                                <div className="empty-state-desc">Create your first test execution run</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[...state.executionRuns].reverse().map(run => {
                                    const st = calculateRunStats(run);
                                    const isActive = activeRunId === run.id;
                                    // Count bugs in this run
                                    const bugCount = Object.values(run.results).filter(r => r.bug).length;
                                    return (
                                        <div key={run.id}
                                            onClick={() => setActiveRunId(isActive ? null : run.id)}
                                            style={{
                                                background: isActive ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'var(--color-border)'}`,
                                                borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                                            }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{run.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>📅 {new Date(run.startedAt).toLocaleDateString()} · 🌐 {run.environment}</div>
                                                </div>
                                                <span className={`badge badge-${run.status === 'Completed' ? 'success' : run.status === 'In Progress' ? 'info' : 'danger'}`}>
                                                    {run.status === 'In Progress' && <><span className="animate-pulse">●</span> </>}{run.status}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 11 }}>
                                                <span style={{ color: 'var(--color-success)' }}>✅ {st.pass}</span>
                                                <span style={{ color: 'var(--color-danger)' }}>❌ {st.fail}</span>
                                                <span style={{ color: 'var(--color-warning)' }}>⚠️ {st.blocked}</span>
                                                <span style={{ color: 'var(--color-text-muted)' }}>⬜ {st.notRun}</span>
                                                {bugCount > 0 && <span style={{ color: 'var(--color-danger)', marginLeft: 4 }}>🐛 {bugCount} bug{bugCount > 1 ? 's' : ''}</span>}
                                                <span style={{ marginLeft: 'auto', fontWeight: 600, color: st.passRate >= 80 ? 'var(--color-success)' : st.passRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{st.passRate}%</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div className="progress-fill success" style={{ width: `${st.passRate}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Run Detail */}
                {activeRun && (
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <div className="card-title" style={{ fontSize: 17 }}>{activeRun.name}</div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                    <span className="badge badge-muted">🌐 {activeRun.environment}</span>
                                    <span className={`badge badge-${activeRun.status === 'Completed' ? 'success' : activeRun.status === 'In Progress' ? 'info' : 'danger'}`}>{activeRun.status}</span>
                                    <span className="badge badge-muted">📅 {new Date(activeRun.startedAt).toLocaleString()}</span>
                                    {Object.values(activeRun.results).filter(r => r.bug).length > 0 && (
                                        <span className="badge badge-danger">
                                            🐛 {Object.values(activeRun.results).filter(r => r.bug).length} Bug(s) Linked
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {(() => {
                                    const st = calculateRunStats(activeRun); return (
                                        <>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: st.passRate >= 80 ? 'var(--color-success)' : st.passRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{st.passRate}%</div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Pass Rate</div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* TC Execution List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {activeRun.testCases.map(tcId => {
                                const tc = state.testCases.find(t => t.id === tcId);
                                const result = activeRun.results[tcId];
                                const isExecuting = executingTCId === tcId;
                                const bug = result?.bug;

                                if (!tc) return null;

                                return (
                                    <div key={tcId} style={{
                                        background: isExecuting ? 'rgba(59,130,246,0.06)' : result?.status === 'Fail' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${isExecuting ? 'rgba(59,130,246,0.3)' : result?.status === 'Fail' ? 'rgba(239,68,68,0.2)' : 'var(--color-border)'}`,
                                        borderRadius: 'var(--radius-md)', padding: '14px 16px', transition: 'all 0.2s',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isExecuting ? 16 : 0 }}>
                                            <span style={{ fontSize: 20 }}>{STATUS_ICONS[(result?.status as TestStatus) || 'Not Run']}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{tc.tcId}</span>
                                                    <span className={`badge badge-${getPriorityColor(tc.priority)}`} style={{ fontSize: 10 }}>{tc.priority}</span>
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 2 }}>{tc.title}</div>
                                                {result && (
                                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                                                        👤 {result.executedBy} · {result.executedAt ? new Date(result.executedAt).toLocaleTimeString() : ''}
                                                        {result.comment && <span> · 💬 {result.comment}</span>}
                                                    </div>
                                                )}
                                                {result?.screenshotUrls && result.screenshotUrls.length > 0 && (
                                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                                        {result.screenshotUrls.map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                                                <img src={url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Inline Bug Badge */}
                                                {bug && (
                                                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span className={`badge badge-${SEVERITY_COLORS[bug.severity]}`} style={{ fontSize: 10 }}>🐛 {bug.bugId}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600 }}>{bug.title}</span>
                                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '1px 6px' }}
                                                            onClick={() => setViewBugTCId(viewBugTCId === tcId ? null : tcId)}>
                                                            {viewBugTCId === tcId ? 'Hide' : 'Details'}
                                                        </button>
                                                        {bug.url && (
                                                            <a href={bug.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--color-primary-light)' }}>🔗 Open</a>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Expanded Bug Details */}
                                                {bug && viewBugTCId === tcId && (
                                                    <div style={{ marginTop: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                                                            <span><strong style={{ color: 'var(--color-text-muted)' }}>ID:</strong> <span style={{ fontFamily: 'monospace' }}>{bug.bugId}</span></span>
                                                            <span><strong style={{ color: 'var(--color-text-muted)' }}>Severity:</strong> <span className={`badge badge-${SEVERITY_COLORS[bug.severity]}`} style={{ fontSize: 10 }}>{bug.severity}</span></span>
                                                        </div>
                                                        {bug.description && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>{bug.description}</div>}
                                                        {bug.url && <div style={{ marginTop: 4, fontSize: 11 }}><a href={bug.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary-light)' }}>🔗 {bug.url}</a></div>}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                                {!result && activeRun.status === 'In Progress' && (
                                                    <button className="btn btn-outline btn-sm" onClick={() => { setExecutingTCId(isExecuting ? null : tcId); setComment(''); setScreenshots(prev => { const n = { ...prev }; delete n[tcId]; return n; }); }}>
                                                        {isExecuting ? 'Cancel' : '▶️ Execute'}
                                                    </button>
                                                )}
                                                {result && (
                                                    <span className={`badge badge-${getStatusColor(result.status)}`}>{result.status}</span>
                                                )}
                                                {result?.status === 'Fail' && !bug && activeRun.status === 'In Progress' && (
                                                    <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }}
                                                        onClick={() => { setPendingFailTCId(tcId); setBugForm({ bugId: '', title: '', severity: 'High', url: '', description: '' }); setShowBugModal(true); }}>
                                                        🐛 Link Bug
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Execute Panel */}
                                        {isExecuting && (
                                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Test Steps</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                                    {tc.steps.map((step, i) => (
                                                        <div key={step.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', gap: 10 }}>
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', flexShrink: 0, marginTop: 1 }}>#{i + 1}</span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{step.action}</div>
                                                                <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 2 }}>Expected: {step.expectedResult}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                {(['Pass', 'Fail'] as const).map(s => (
                                                                    <button key={s} onClick={() => {
                                                                        setStepResults({ ...stepResults, [step.id]: s });
                                                                        if (s === 'Fail') {
                                                                            handleMarkResult(tcId, 'Fail');
                                                                        }
                                                                    }}
                                                                        className={`btn btn-sm ${stepResults[step.id] === s ? (s === 'Pass' ? 'btn-success' : 'btn-danger') : 'btn-outline'}`}
                                                                        style={{ padding: '2px 8px', fontSize: 11 }}>
                                                                        {s === 'Pass' ? '✅' : '❌'}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="form-group" style={{ marginBottom: 12 }}>
                                                    <label className="form-label">Comment (optional)</label>
                                                    <input className="form-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Add execution notes..." />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 12 }}>
                                                    <label className="form-label">Screenshots (optional)</label>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                                        {(screenshots[tcId] || []).map((url, i) => (
                                                            <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                                                <img src={url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                <button onClick={() => removeScreenshot(tcId, i)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: '18px', padding: 0 }}>✕</button>
                                                            </div>
                                                        ))}
                                                        <label style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 22, color: 'var(--color-text-muted)' }}>
                                                            +
                                                            <input type="file" accept="image/png,image/jpeg,image/gif" multiple style={{ display: 'none' }} onChange={e => handleScreenshotUpload(tcId, e)} />
                                                        </label>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="btn btn-success" onClick={() => handleMarkResult(tcId, 'Pass')} id={`pass-${tcId}`}>✅ Mark Pass</button>
                                                    <button className="btn btn-danger" onClick={() => handleMarkResult(tcId, 'Fail')} id={`fail-${tcId}`}>❌ Mark Fail</button>
                                                    <button className="btn btn-outline" onClick={() => handleMarkResult(tcId, 'Blocked')} id={`blocked-${tcId}`}>⚠️ Blocked</button>
                                                    <button className="btn btn-ghost" onClick={() => handleMarkResult(tcId, 'Skipped')} id={`skip-${tcId}`}>⏭️ Skip</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {activeRun.status === 'Completed' && (
                            <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-success)' }}>Run Completed!</div>
                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                    {activeRun.completedAt ? `Finished at ${new Date(activeRun.completedAt).toLocaleString()}` : ''}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bug Association Modal */}
            {showBugModal && (
                <div className="modal-overlay" onClick={closeBugModal} role="dialog" aria-modal="true" aria-label="Link Bug">
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '2px solid rgba(239,68,68,0.3)' }}>
                            <div>
                                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 22 }}>🐛</span> Link Bug to Failed Test
                                </div>
                                <div className="modal-subtitle">
                                    Associate a bug/defect with this test case failure. You can skip if the bug is already tracked.
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowBugModal(false); setPendingFailTCId(null); }}>✕</button>
                        </div>

                        {/* Failed TC Info */}
                        {pendingFailTCId && (() => {
                            const tc = state.testCases.find(t => t.id === pendingFailTCId);
                            return tc ? (
                                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span>❌</span>
                                    <div>
                                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{tc.tcId}</span>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>{tc.title}</div>
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Bug / Defect ID</label>
                                <input className="form-input" style={{ fontFamily: 'monospace' }}
                                    placeholder="e.g. BUG-1234 or JIRA-567"
                                    value={bugForm.bugId}
                                    onChange={e => setBugForm({ ...bugForm, bugId: e.target.value })} />
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Leave empty to auto-generate</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Severity *</label>
                                <select className="form-select" value={bugForm.severity}
                                    onChange={e => setBugForm({ ...bugForm, severity: e.target.value as BugReport['severity'] })}>
                                    {['Critical', 'High', 'Medium', 'Low'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Bug Title / Summary *</label>
                            <input className="form-input"
                                placeholder="Brief summary of the defect..."
                                value={bugForm.title}
                                onChange={e => setBugForm({ ...bugForm, title: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Bug Tracker URL</label>
                            <input className="form-input" type="url"
                                placeholder="https://jira.company.com/browse/BUG-1234"
                                value={bugForm.url}
                                onChange={e => setBugForm({ ...bugForm, url: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description / Steps to Reproduce</label>
                            <textarea className="form-textarea" rows={3}
                                placeholder="Describe the defect and reproduction steps..."
                                value={bugForm.description}
                                onChange={e => setBugForm({ ...bugForm, description: e.target.value })} />
                        </div>

                        <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                            💡 <strong>Tip:</strong> If this bug is already tracked in Jira or ServiceNow, paste the issue URL above. The platform will display a clickable link next to the failed test case.
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={handleSkipBugAndFail}>
                                Mark Fail (No Bug)
                            </button>
                            <button className="btn btn-outline" onClick={() => { setShowBugModal(false); setPendingFailTCId(null); }}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleSaveBugAndFail} disabled={!bugForm.title.trim()}>
                                🐛 Link Bug & Mark Fail
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Run Modal */}
            {showNewRun && (
                <div className="modal-overlay" onClick={closeNewRunModal} role="dialog" aria-modal="true" aria-label="Create Execution Run">
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">Create Execution Run</div>
                                <div className="modal-subtitle">Select a folder and test cases to include in this run</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewRun(false)}>✕</button>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Run Name *</label>
                                <input className="form-input" value={runForm.name} onChange={e => setRunForm({ ...runForm, name: e.target.value })} placeholder="Sprint 6 Regression" id="run-name-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Environment</label>
                                <select className="form-select" value={runForm.environment} onChange={e => setRunForm({ ...runForm, environment: e.target.value })}>
                                    {['Development', 'Staging', 'UAT', 'Production', 'QA'].map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Select Folder/Release *</label>
                            <select className="form-select" value={runForm.folderId} onChange={e => setRunForm({ ...runForm, folderId: e.target.value, selectedTCs: [] })}>
                                <option value="">— Choose a folder —</option>
                                {state.folders.filter(f => !f.parentId).map(parent => {
                                    const children = state.folders.filter(f => f.parentId === parent.id);
                                    return [
                                        <option key={parent.id} value={parent.id}>📁 {parent.name}</option>,
                                        ...children.map(child => <option key={child.id} value={child.id}>&nbsp;&nbsp;&nbsp;📂 {child.name} ({parent.name})</option>),
                                    ];
                                }).flat()}
                            </select>
                        </div>

                        {runForm.folderId && (
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <label className="form-label" style={{ margin: 0 }}>Select Test Cases ({runForm.selectedTCs.length}/{folderTCs.length})</label>
                                    <button className="btn btn-ghost btn-sm" onClick={selectAllTCs}>
                                        {runForm.selectedTCs.length === folderTCs.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {folderTCs.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                        No test cases in this folder
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
                                        {folderTCs.map(tc => (
                                            <label key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: runForm.selectedTCs.includes(tc.id) ? 'rgba(59,130,246,0.08)' : 'transparent', transition: 'background 0.15s' }}>
                                                <input type="checkbox" className="table-checkbox" checked={runForm.selectedTCs.includes(tc.id)} onChange={() => toggleTCSelect(tc.id)} />
                                                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{tc.tcId}</span>
                                                <span className={`badge badge-${getPriorityColor(tc.priority)}`} style={{ fontSize: 10 }}>{tc.priority}</span>
                                                <span style={{ fontSize: 13, flex: 1 }}>{tc.title}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowNewRun(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateRun} disabled={!runForm.name || runForm.selectedTCs.length === 0} id="start-run-btn">
                                ▶️ Start Execution Run ({runForm.selectedTCs.length} TCs)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
