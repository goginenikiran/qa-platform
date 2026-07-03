'use client';

import React, { useState, useMemo } from 'react';
import {
    useApp, ExecutionRun, TestStatus, generateId,
    getStatusColor, getPriorityColor, calculateRunStats
} from '../store/AppContext';

type ExecutionResultEntry = ExecutionRun['results'][string];

const STATUS_ICONS: Record<TestStatus, string> = {
    'Pass': '✅', 'Fail': '❌', 'Blocked': '⚠️', 'Skipped': '⏭️', 'Not Run': '⬜',
};

interface IntegrationRunForm {
    name: string;
    release: string;
    environment: string;
    selectedFolderIds: string[];
    selectedTCIds: string[];
}

export default function IntegrationRuns() {
    const { state, dispatch } = useApp();
    const { executionRuns, folders, testCases, currentUser } = state;
    const [activeTab, setActiveTab] = useState<'runs' | 'new'>('runs');
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [executingTCId, setExecutingTCId] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [stepResults, setStepResults] = useState<Record<string, string>>({});
    // Step tracker for new integration run wizard
    const [formStep, setFormStep] = useState<1 | 2 | 3>(1);

    // Bug modal
    const [showBugModal, setShowBugModal] = useState(false);
    const [pendingFailTCId, setPendingFailTCId] = useState<string | null>(null);
    const [bugForm, setBugForm] = useState<{
        bugId: string;
        title: string;
        severity: 'Critical' | 'High' | 'Medium' | 'Low';
        url: string;
        description: string;
    }>({ bugId: '', title: '', severity: 'High', url: '', description: '' });

    const [form, setForm] = useState<IntegrationRunForm>({
        name: '', release: '', environment: 'Staging',
        selectedFolderIds: [], selectedTCIds: [],
    });

    const activeRun = useMemo(() =>
        executionRuns.find(r => r.id === activeRunId),
        [activeRunId, executionRuns]
    );

    // Integration runs = execution runs that span multiple folders (tagged by having 'integration' in name or multiple unique folderIds)
    const integrationRuns = useMemo(() => {
        return executionRuns.filter(r => r.isIntegration);
    }, [executionRuns]);

    // Filter folders the current user can see (Admin sees all)
    const isAdmin = currentUser?.role === 'Admin';
    const visibleFolders = useMemo(() =>
        folders.filter(f => isAdmin || !f.teamId || currentUser?.teamIds.includes(f.teamId)),
        [folders, currentUser, isAdmin]
    );

    // Release folders (type='release') visible to the user
    const releaseFolders = useMemo(() =>
        visibleFolders.filter(f => f.type === 'release'),
        [visibleFolders]
    );

    // Component folders = module-type folders that belong to the selected release
    const componentFolders = useMemo(() => {
        if (!form.release) return visibleFolders.filter(f => f.type === 'module');
        // Find the release folder whose name matches selected release
        const releaseFolder = folders.find(f => f.type === 'release' && f.name === form.release);
        if (!releaseFolder) return visibleFolders.filter(f => f.type === 'module');
        return visibleFolders.filter(f => f.type === 'module' && f.parentId === releaseFolder.id);
    }, [form.release, folders, visibleFolders]);

    // TCs from selected folders
    const availableTCs = useMemo(() => {
        if (form.selectedFolderIds.length === 0) return [];
        return testCases.filter(tc => form.selectedFolderIds.includes(tc.folderId));
    }, [form.selectedFolderIds, testCases]);

    const canStartRun = form.name.trim().length > 0 && form.selectedTCIds.length > 0;

    const toggleFolder = (folderId: string) => {
        const next = form.selectedFolderIds.includes(folderId)
            ? form.selectedFolderIds.filter(id => id !== folderId)
            : [...form.selectedFolderIds, folderId];
        // Also remove TCs from de-selected folders
        const nextTCs = form.selectedTCIds.filter(tcId => {
            const tc = testCases.find(t => t.id === tcId);
            return tc && next.includes(tc.folderId);
        });
        setForm({ ...form, selectedFolderIds: next, selectedTCIds: nextTCs });
    };

    const toggleTC = (tcId: string) => {
        const next = form.selectedTCIds.includes(tcId)
            ? form.selectedTCIds.filter(id => id !== tcId)
            : [...form.selectedTCIds, tcId];
        setForm({ ...form, selectedTCIds: next });
    };

    const selectAllTCs = () => {
        // Use snapshot of availableTCs ids to avoid stale closure
        const allIds = availableTCs.map(t => t.id);
        const allSelected = allIds.length > 0 && allIds.every(id => form.selectedTCIds.includes(id));
        if (allSelected) {
            setForm(prev => ({ ...prev, selectedTCIds: [] }));
        } else {
            setForm(prev => ({ ...prev, selectedTCIds: allIds }));
        }
    };

    const handleCreateRun = () => {
        if (!canStartRun) return;
        const newRun: ExecutionRun = {
            id: generateId(),
            name: form.name,
            folderId: form.selectedFolderIds[0] || '',
            testCases: form.selectedTCIds,
            results: {},
            startedAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'Admin',
            status: 'In Progress' as const,
            environment: form.environment,
            isIntegration: true,
            release: form.release,
            integrationFolderIds: form.selectedFolderIds,
        };
        dispatch({ type: 'ADD_EXECUTION_RUN', payload: newRun });
        setActiveRunId(newRun.id);
        setActiveTab('runs');
        setFormStep(1);
        setForm({ name: '', release: '', environment: 'Staging', selectedFolderIds: [], selectedTCIds: [] });
    };

    const commitResult = (tcId: string, status: TestStatus, bug?: { bugId: string; title: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; url?: string; description?: string }) => {
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
            createdBy: currentUser?.name || 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } : undefined;

        const resultEntry: ExecutionResultEntry = {
            status,
            comment: comment || undefined,
            executedAt: new Date().toISOString(),
            executedBy: currentUser?.name || 'Admin',
            bug: bugObj,
        };
        const updated: ExecutionRun = {
            ...activeRun,
            results: { ...activeRun.results, [tcId]: resultEntry },
        };
        const allDone = updated.testCases.every(id => updated.results[id]);
        if (allDone) updated.status = 'Completed';
        dispatch({ type: 'UPDATE_EXECUTION_RUN', payload: updated });
        const tc = testCases.find(t => t.id === tcId);
        if (tc) dispatch({ type: 'UPDATE_TEST_CASE', payload: { ...tc, status } });
        if (bugObj) {
            dispatch({ type: 'ADD_BUG', payload: bugObj });
        }
        setExecutingTCId(null);
        setComment('');
        setStepResults({});
    };

    const handleMarkResult = (tcId: string, status: TestStatus) => {
        if (status === 'Fail') {
            setPendingFailTCId(tcId);
            setBugForm({ bugId: '', title: '', severity: 'High', url: '', description: '' });
            setShowBugModal(true);
        } else {
            commitResult(tcId, status);
        }
    };

    const handleSaveBug = () => {
        if (!pendingFailTCId) return;
        const bugId = bugForm.bugId || `BUG-${Date.now().toString(36).toUpperCase()}`;
        commitResult(pendingFailTCId, 'Fail', bugForm.title ? { ...bugForm, bugId } : undefined);
        setShowBugModal(false);
        setPendingFailTCId(null);
    };

    const handleAbort = () => {
        if (!activeRun || !confirm('Abort this integration run?')) return;
        dispatch({ type: 'UPDATE_EXECUTION_RUN', payload: { ...activeRun, status: 'Aborted', completedAt: new Date().toISOString() } });
        setActiveRunId(null);
    };

    const SEVERITY_COLORS: Record<string, string> = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'muted' };

    // Group TCs in active run by folder
    const tcsByFolder = useMemo(() => {
        if (!activeRun) return [];
        const groups: { folder: { id: string; name: string; color: string } | null; tcs: typeof testCases }[] = [];
        const seen = new Set<string>();
        activeRun.testCases.forEach(tcId => {
            const tc = testCases.find(t => t.id === tcId);
            if (!tc) return;
            if (!seen.has(tc.folderId)) {
                seen.add(tc.folderId);
                const folder = folders.find(f => f.id === tc.folderId);
                groups.push({
                    folder: folder ? { id: folder.id, name: folder.name, color: folder.color } : null,
                    tcs: activeRun.testCases
                        .map(id => testCases.find(t => t.id === id))
                        .filter(t => t && t.folderId === tc.folderId) as typeof testCases,
                });
            }
        });
        return groups;
    }, [activeRun, testCases, folders]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">⚡ Integration Test Runs</div>
                    <div className="page-subtitle">Execute cross-team integration test suites per release</div>
                </div>
                <div className="page-header-actions">
                    {activeRun && activeRun.status === 'In Progress' && (
                        <button className="btn btn-danger" onClick={handleAbort}>⛔ Abort Run</button>
                    )}
                    <button className={`btn ${activeTab === 'new' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => {
                            if (activeTab === 'new') {
                                setActiveTab('runs');
                                setFormStep(1);
                                setForm({ name: '', release: '', environment: 'Staging', selectedFolderIds: [], selectedTCIds: [] });
                            } else {
                                setActiveTab('new');
                                setFormStep(1);
                            }
                        }}>
                        {activeTab === 'new' ? '✕ Cancel' : '+ New Integration Run'}
                    </button>
                </div>
            </div>

            {/* New Run Form — 3-Step Wizard */}
            {activeTab === 'new' && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <div className="card-title">🔧 Configure Integration Run</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Cross-team integration test suite — follow the steps below</div>
                    </div>

                    {/* Step Progress Indicator */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                        {[
                            { n: 1, label: 'Run Details' },
                            { n: 2, label: 'Components' },
                            { n: 3, label: 'Test Cases' },
                        ].map(({ n, label }, idx) => {
                            const done = formStep > n;
                            const active = formStep === n;
                            return (
                                <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, fontWeight: 700,
                                            background: done ? 'var(--color-success)' : active ? 'var(--color-primary)' : 'var(--color-border)',
                                            color: (done || active) ? 'white' : 'var(--color-text-muted)',
                                            transition: 'all 0.2s',
                                        }}>
                                            {done ? '✓' : n}
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{label}</span>
                                    </div>
                                    {idx < 2 && <div style={{ flex: 1, height: 1, background: done ? 'var(--color-success)' : 'var(--color-border)', margin: '0 12px', transition: 'background 0.2s' }} />}
                                </div>
                            );
                        })}
                    </div>

                    {/* STEP 1: Run Details */}
                    {formStep === 1 && (
                        <div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Run Name *</label>
                                    <input className="form-input" value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g. Release 2.0 Integration Suite" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Release *</label>
                                    <select className="form-select" value={form.release}
                                        onChange={e => {
                                            // Reset components and TCs when release changes
                                            setForm({ ...form, release: e.target.value, selectedFolderIds: [], selectedTCIds: [] });
                                        }}>
                                        <option value="">— Select Release —</option>
                                        {releaseFolders.map(r => (
                                            <option key={r.id} value={r.name}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Environment</label>
                                    <select className="form-select" value={form.environment}
                                        onChange={e => setForm({ ...form, environment: e.target.value })}>
                                        {['Development', 'Staging', 'UAT', 'Production', 'QA'].map(e => (
                                            <option key={e} value={e}>{e}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                <button className="btn btn-outline" onClick={() => setActiveTab('runs')}>Cancel</button>
                                <button className="btn btn-primary"
                                    onClick={() => setFormStep(2)}
                                    disabled={!form.name.trim()}>
                                    Next: Select Components →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Select Release Components (Folders) */}
                    {formStep === 2 && (
                        <div>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <label className="form-label" style={{ margin: 0 }}>
                                        Select Components / Modules
                                        {form.release && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>({form.release})</span>}
                                    </label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span className="badge badge-muted">{form.selectedFolderIds.length} selected</span>
                                        <button className="btn btn-ghost btn-sm" onClick={() => {
                                            const allIds = componentFolders.filter(f => testCases.some(tc => tc.folderId === f.id)).map(f => f.id);
                                            const allSelected = allIds.length > 0 && allIds.every(id => form.selectedFolderIds.includes(id));
                                            setForm(prev => ({ ...prev, selectedFolderIds: allSelected ? [] : allIds, selectedTCIds: [] }));
                                        }}>
                                            {componentFolders.filter(f => testCases.some(tc => tc.folderId === f.id)).every(f => form.selectedFolderIds.includes(f.id)) && form.selectedFolderIds.length > 0
                                                ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                </div>
                                {componentFolders.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                        No component folders found{form.release ? ` for ${form.release}` : ''}. Please check your releases and folders setup.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                        {componentFolders.map(folder => {
                                            const isSelected = form.selectedFolderIds.includes(folder.id);
                                            const tcCount = testCases.filter(t => t.folderId === folder.id).length;
                                            const team = state.teams.find(t => t.id === folder.teamId);
                                            return (
                                                <div key={folder.id}
                                                    onClick={() => toggleFolder(folder.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                        border: `1px solid ${isSelected ? folder.color : 'var(--color-border)'}`,
                                                        background: isSelected ? `${folder.color}14` : 'rgba(255,255,255,0.02)',
                                                        transition: 'all 0.15s',
                                                        opacity: tcCount === 0 ? 0.5 : 1,
                                                    }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: folder.color, flexShrink: 0 }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{folder.name}</div>
                                                        {team && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Team: {team.name}</div>}
                                                    </div>
                                                    <span className="badge badge-muted" style={{ fontSize: 10 }}>{tcCount} TCs</span>
                                                    {isSelected && <span style={{ color: folder.color, fontSize: 16 }}>✓</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                                <button className="btn btn-outline" onClick={() => setFormStep(1)}>← Back</button>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn btn-outline" onClick={() => setActiveTab('runs')}>Cancel</button>
                                    <button className="btn btn-primary"
                                        onClick={() => setFormStep(3)}
                                        disabled={form.selectedFolderIds.length === 0}>
                                        Next: Select Test Cases ({availableTCs.length} available) →
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Select Test Cases */}
                    {formStep === 3 && (
                        <div>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <label className="form-label" style={{ margin: 0 }}>
                                        Select Test Cases ({form.selectedTCIds.length}/{availableTCs.length})
                                    </label>
                                    <button className="btn btn-ghost btn-sm" onClick={selectAllTCs}>
                                        {availableTCs.length > 0 && availableTCs.every(t => form.selectedTCIds.includes(t.id)) ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {availableTCs.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                        No test cases found in the selected components. Go back and choose different components.
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                                        {form.selectedFolderIds.map(folderId => {
                                            const folder = folders.find(f => f.id === folderId);
                                            const folderTCs = availableTCs.filter(tc => tc.folderId === folderId);
                                            if (!folderTCs.length) return null;
                                            const allFolderSelected = folderTCs.every(tc => form.selectedTCIds.includes(tc.id));
                                            return (
                                                <div key={folderId} style={{ marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: folder?.color || 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: `3px solid ${folder?.color || '#475569'}`, paddingLeft: 8 }}>
                                                            📁 {folder?.name}
                                                        </div>
                                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '1px 8px' }}
                                                            onClick={() => {
                                                                const folderIds = folderTCs.map(t => t.id);
                                                                if (allFolderSelected) {
                                                                    setForm(prev => ({ ...prev, selectedTCIds: prev.selectedTCIds.filter(id => !folderIds.includes(id)) }));
                                                                } else {
                                                                    setForm(prev => ({ ...prev, selectedTCIds: [...new Set([...prev.selectedTCIds, ...folderIds])] }));
                                                                }
                                                            }}>
                                                            {allFolderSelected ? 'Deselect' : 'Select all'}
                                                        </button>
                                                    </div>
                                                    {folderTCs.map(tc => (
                                                        <label key={tc.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                            background: form.selectedTCIds.includes(tc.id) ? 'rgba(59,130,246,0.08)' : 'transparent',
                                                        }}>
                                                            <input type="checkbox" className="table-checkbox"
                                                                checked={form.selectedTCIds.includes(tc.id)}
                                                                onChange={() => toggleTC(tc.id)} />
                                                            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{tc.tcId}</span>
                                                            <span className={`badge badge-${getPriorityColor(tc.priority)}`} style={{ fontSize: 10 }}>{tc.priority}</span>
                                                            <span style={{ fontSize: 13, flex: 1 }}>{tc.title}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Status bar showing readiness */}
                            <div style={{
                                padding: '10px 14px', borderRadius: 'var(--radius-md)', marginTop: 8, marginBottom: 8,
                                background: canStartRun ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${canStartRun ? 'rgba(16,185,129,0.25)' : 'var(--color-border)'}`,
                                display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
                            }}>
                                <span>{canStartRun ? '✅' : '⬜'}</span>
                                <div style={{ flex: 1, color: canStartRun ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                    {canStartRun
                                        ? `Ready! "${form.name}" — ${form.selectedTCIds.length} TCs across ${form.selectedFolderIds.length} component(s)`
                                        : `Select at least 1 test case to start the run`}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <button className="btn btn-outline" onClick={() => setFormStep(2)}>← Back</button>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn btn-outline" onClick={() => setActiveTab('runs')}>Cancel</button>
                                    <button className="btn btn-primary"
                                        onClick={handleCreateRun}
                                        disabled={!canStartRun}>
                                        ⚡ Start Integration Run ({form.selectedTCIds.length} TCs)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Runs List + Detail */}
            {activeTab === 'runs' && (
                <div style={{ display: 'grid', gridTemplateColumns: activeRun ? '320px 1fr' : '1fr', gap: 20 }}>
                    {/* Run List */}
                    <div>
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Integration Runs</div>
                                <span className="badge badge-primary">{integrationRuns.length}</span>
                            </div>
                            {integrationRuns.length === 0 ? (
                                <div className="empty-state" style={{ padding: '30px 20px' }}>
                                    <div className="empty-state-icon">⚡</div>
                                    <div className="empty-state-title">No integration runs yet</div>
                                    <div className="empty-state-desc">Create a cross-team integration run to test your release</div>
                                    <button className="btn btn-primary" onClick={() => setActiveTab('new')}>+ New Integration Run</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[...integrationRuns].reverse().map(run => {
                                        const st = calculateRunStats(run);
                                        const isActive = activeRunId === run.id;
                                        const bugCount = Object.values(run.results).filter(r => r.bug).length;
                                        return (
                                            <div key={run.id}
                                                onClick={() => setActiveRunId(isActive ? null : run.id)}
                                                style={{
                                                    background: isActive ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'var(--color-border)'}`,
                                                    borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer',
                                                }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{run.name}</div>
                                                    <span className={`badge badge-${run.status === 'Completed' ? 'success' : run.status === 'In Progress' ? 'info' : 'danger'}`}>
                                                        {run.status}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                                                    🌐 {run.environment} · 📅 {new Date(run.startedAt).toLocaleDateString()}
                                                    {run.release && ` · 🏷️ ${run.release}`}
                                                </div>
                                                <div style={{ display: 'flex', gap: 10, fontSize: 11, marginBottom: 6 }}>
                                                    <span style={{ color: 'var(--color-success)' }}>✅ {st.pass}</span>
                                                    <span style={{ color: 'var(--color-danger)' }}>❌ {st.fail}</span>
                                                    <span style={{ color: 'var(--color-warning)' }}>⚠️ {st.blocked}</span>
                                                    <span style={{ color: 'var(--color-text-muted)' }}>⬜ {st.notRun}</span>
                                                    {bugCount > 0 && <span style={{ color: 'var(--color-danger)' }}>🐛 {bugCount}</span>}
                                                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: st.passRate >= 80 ? 'var(--color-success)' : st.passRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{st.passRate}%</span>
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
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                        <span className="badge badge-muted">🌐 {activeRun.environment}</span>
                                        {activeRun.release && <span className="badge badge-accent">🏷️ {activeRun.release}</span>}
                                        <span className={`badge badge-${activeRun.status === 'Completed' ? 'success' : activeRun.status === 'In Progress' ? 'info' : 'danger'}`}>{activeRun.status}</span>
                                        <span className="badge badge-primary">⚡ Integration Run</span>
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

                            {/* Grouped by folder/team */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {tcsByFolder.map(({ folder, tcs }) => (
                                    <div key={folder?.id || 'unknown'}>
                                        {/* Team folder header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4, borderLeft: `3px solid ${folder?.color || '#475569'}` }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: folder?.color || 'var(--color-text-muted)' }}>
                                                📁 {folder?.name || 'Unknown Folder'}
                                            </span>
                                            <span className="badge badge-muted" style={{ fontSize: 10 }}>
                                                {tcs.filter(tc => activeRun.results[tc.id]?.status === 'Pass').length}/{tcs.length} passed
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {tcs.map(tc => {
                                                const result = activeRun.results[tc.id];
                                                const isExecuting = executingTCId === tc.id;
                                                const bug = result?.bug;
                                                return (
                                                    <div key={tc.id} style={{
                                                        background: isExecuting ? 'rgba(59,130,246,0.06)' : result?.status === 'Fail' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px solid ${isExecuting ? 'rgba(59,130,246,0.3)' : result?.status === 'Fail' ? 'rgba(239,68,68,0.2)' : 'var(--color-border)'}`,
                                                        borderRadius: 'var(--radius-md)', padding: '12px 14px',
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span style={{ fontSize: 18 }}>{STATUS_ICONS[(result?.status as TestStatus) || 'Not Run']}</span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{tc.tcId}</span>
                                                                    <span className={`badge badge-${getPriorityColor(tc.priority)}`} style={{ fontSize: 10 }}>{tc.priority}</span>
                                                                </div>
                                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{tc.title}</div>
                                                                {result && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>👤 {result.executedBy}</div>}
                                                                {bug && (
                                                                    <div style={{ marginTop: 4 }}>
                                                                        <span className={`badge badge-${SEVERITY_COLORS[bug.severity]}`} style={{ fontSize: 10 }}>🐛 {bug.bugId} — {bug.title}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                {result && <span className={`badge badge-${getStatusColor(result.status)}`}>{result.status}</span>}
                                                                {!result && activeRun.status === 'In Progress' && (
                                                                    <button className="btn btn-outline btn-sm" onClick={() => { setExecutingTCId(isExecuting ? null : tc.id); setComment(''); }}>
                                                                        {isExecuting ? 'Cancel' : '▶️'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {isExecuting && (
                                                            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 12 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Test Steps</div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                                                                    {tc.steps.map((step, i) => (
                                                                        <div key={step.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', display: 'flex', gap: 8 }}>
                                                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', flexShrink: 0 }}>#{i + 1}</span>
                                                                            <div style={{ flex: 1, fontSize: 12 }}>
                                                                                <div>{step.action}</div>
                                                                                <div style={{ color: 'var(--color-success)', fontSize: 11 }}>Expected: {step.expectedResult}</div>
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                                {(['Pass', 'Fail'] as const).map(s => (
                                                                                    <button key={s}
                                                                                        onClick={() => {
                                                                                            setStepResults({ ...stepResults, [step.id]: s });
                                                                                            if (s === 'Fail') {
                                                                                                handleMarkResult(tc.id, 'Fail');
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
                                                                <input className="form-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Execution note..." style={{ marginBottom: 10 }} />
                                                                <div style={{ display: 'flex', gap: 8 }}>
                                                                    <button className="btn btn-success btn-sm" onClick={() => handleMarkResult(tc.id, 'Pass')}>✅ Pass</button>
                                                                    <button className="btn btn-danger btn-sm" onClick={() => handleMarkResult(tc.id, 'Fail')}>❌ Fail</button>
                                                                    <button className="btn btn-outline btn-sm" onClick={() => handleMarkResult(tc.id, 'Blocked')}>⚠️ Blocked</button>
                                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleMarkResult(tc.id, 'Skipped')}>⏭️ Skip</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {activeRun.status === 'Completed' && (
                                <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, marginBottom: 4 }}>🎉</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-success)' }}>Integration Run Complete!</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Bug Modal */}
            {showBugModal && (
                <div className="modal-overlay" onClick={() => { setShowBugModal(false); setPendingFailTCId(null); }}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">🐛 Link Bug to Failed Test</div>
                                <div className="modal-subtitle">Associate a defect with this integration test failure</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowBugModal(false); setPendingFailTCId(null); }}>✕</button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Bug ID</label>
                                <input className="form-input" style={{ fontFamily: 'monospace' }} placeholder="e.g. JIRA-123 (auto if empty)"
                                    value={bugForm.bugId} onChange={e => setBugForm({ ...bugForm, bugId: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Severity</label>
                                <select className="form-select" value={bugForm.severity} onChange={e => setBugForm({ ...bugForm, severity: e.target.value as 'Critical' | 'High' | 'Medium' | 'Low' })}>
                                    {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bug Title *</label>
                            <input className="form-input" placeholder="Summary of the defect" value={bugForm.title} onChange={e => setBugForm({ ...bugForm, title: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tracker URL</label>
                            <input className="form-input" type="url" placeholder="https://jira.company.com/browse/BUG-xxx" value={bugForm.url} onChange={e => setBugForm({ ...bugForm, url: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" rows={3} value={bugForm.description} onChange={e => setBugForm({ ...bugForm, description: e.target.value })} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { commitResult(pendingFailTCId!, 'Fail'); setShowBugModal(false); setPendingFailTCId(null); }}>Mark Fail (No Bug)</button>
                            <button className="btn btn-outline" onClick={() => { setShowBugModal(false); setPendingFailTCId(null); }}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleSaveBug} disabled={!bugForm.title.trim()}>🐛 Link Bug & Mark Fail</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
