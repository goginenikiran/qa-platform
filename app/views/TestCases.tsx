'use client';

import React, { useState, useMemo } from 'react';
import { useApp, TestCase, TestStep, generateId, getPriorityColor, Priority, generateTeamTcId, hasPermission } from '../store/AppContext';

export default function TestCases() {
    const { state, dispatch } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [editTC, setEditTC] = useState<TestCase | null>(null);
    const [viewTC, setViewTC] = useState<TestCase | null>(null);
    const [filterPriority, setFilterPriority] = useState('');
    const [filterFolder, setFilterFolder] = useState('');
    const [filterAutomation, setFilterAutomation] = useState('');
    const [filterTeam, setFilterTeam] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [form, setForm] = useState<Partial<TestCase>>({
        title: '', description: '', priority: 'Medium',
        module: '', folderId: '', preconditions: '', tags: [],
        estimatedTime: 5, automationStatus: 'Manual',
        steps: [{ id: generateId(), stepNumber: 1, action: '', expectedResult: '' }],
    });

    const isAdmin = state.currentUser?.role === 'Admin';
    const canDelete = hasPermission(state.currentUser, 'delete');
    const visibleFolders = useMemo(() => {
        return state.folders.filter(f => isAdmin || !f.teamId || state.currentUser?.teamIds.includes(f.teamId));
    }, [state.folders, state.currentUser, isAdmin]);

    const visibleFolderIds = useMemo(() => new Set(visibleFolders.map(f => f.id)), [visibleFolders]);

    const teamByFolderId = useMemo(() => {
        const map: Record<string, { name: string; id: string }> = {};
        state.folders.forEach(f => {
            if (f.teamId) {
                const team = state.teams.find(t => t.id === f.teamId);
                if (team) map[f.id] = { name: team.name, id: team.id };
            }
        });
        return map;
    }, [state.folders, state.teams]);

    const filteredTCs = useMemo(() => {
        return state.testCases.filter(tc => {
            if (!visibleFolderIds.has(tc.folderId)) return false;
            if (filterPriority && tc.priority !== filterPriority) return false;
            if (filterFolder && tc.folderId !== filterFolder) return false;
            if (filterAutomation && tc.automationStatus !== filterAutomation) return false;
            if (filterTeam && teamByFolderId[tc.folderId]?.id !== filterTeam) return false;
            if (searchQ && !tc.title.toLowerCase().includes(searchQ.toLowerCase()) &&
                !tc.tcId.toLowerCase().includes(searchQ.toLowerCase()) &&
                !tc.tags.some(t => t.toLowerCase().includes(searchQ.toLowerCase()))) return false;
            return true;
        });
    }, [state.testCases, filterPriority, filterFolder, filterAutomation, filterTeam, searchQ, visibleFolderIds, teamByFolderId]);

    const openNew = () => {
        setEditTC(null);
        const selectedFolderId = state.selectedFolderId || '';
        const autoTcId = selectedFolderId
            ? generateTeamTcId(selectedFolderId, state.folders, state.teams, state.testCases)
            : `TC-${String(state.testCases.length + 1).padStart(3, '0')}`;
        setForm({
            title: '', description: '', priority: 'Medium',
            module: '', folderId: selectedFolderId,
            preconditions: '', tags: [], estimatedTime: 5, automationStatus: 'Manual',
            steps: [{ id: generateId(), stepNumber: 1, action: '', expectedResult: '' }],
            tcId: autoTcId,
        });
        setShowModal(true);
    };

    const openEdit = (tc: TestCase) => {
        setEditTC(tc);
        setForm({ ...tc });
        setShowModal(true);
    };

    const handleSave = () => {
        if (!form.title?.trim()) return;
        const now = new Date().toISOString();
        if (editTC) {
            dispatch({ type: 'UPDATE_TEST_CASE', payload: { ...editTC, ...form, updatedAt: now } as TestCase });
        } else {
            // Auto-generate team-prefixed ID if user hasn't overridden it
            const folderId = form.folderId || '';
            const autoTcId = folderId
                ? generateTeamTcId(folderId, state.folders, state.teams, state.testCases)
                : `TC-${String(state.testCases.length + 1).padStart(3, '0')}`;
            dispatch({
                type: 'ADD_TEST_CASE',
                payload: {
                    ...form,
                    id: generateId(),
                    tcId: form.tcId || autoTcId,
                    createdBy: state.currentUser?.name || 'Admin',
                    createdAt: now,
                    updatedAt: now,
                } as TestCase,
            });
        }
        setShowModal(false);
    };

    const handleDelete = (id: string) => {
        if (!canDelete) { alert('Only Admin or Lead can delete test cases'); return; }
        if (!confirm('Delete this test case?')) return;
        dispatch({ type: 'DELETE_TEST_CASE', payload: id });
    };

    const handleDeleteSelected = () => {
        if (!canDelete) { alert('Only Admin or Lead can delete test cases'); return; }
        if (!confirm(`Delete ${selectedIds.size} test cases?`)) return;
        selectedIds.forEach(id => dispatch({ type: 'DELETE_TEST_CASE', payload: id }));
        setSelectedIds(new Set());
    };

    const addStep = () => {
        const steps = form.steps || [];
        setForm({ ...form, steps: [...steps, { id: generateId(), stepNumber: steps.length + 1, action: '', expectedResult: '' }] });
    };

    const updateStep = (idx: number, field: keyof TestStep, value: string) => {
        const steps = [...(form.steps || [])];
        steps[idx] = { ...steps[idx], [field]: value };
        setForm({ ...form, steps });
    };

    const removeStep = (idx: number) => {
        const steps = (form.steps || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 }));
        setForm({ ...form, steps });
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredTCs.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredTCs.map(t => t.id)));
    };

    const exportCSV = () => {
        const toExport = selectedIds.size > 0 ? filteredTCs.filter(t => selectedIds.has(t.id)) : filteredTCs;
        const headers = ['TC ID', 'Title', 'Priority', 'Module', 'Preconditions', 'Tags', 'Automation', 'Estimated Time'];
        const rows = toExport.map(tc => [
            tc.tcId, `"${tc.title}"`, tc.priority, tc.module,
            `"${tc.preconditions}"`, tc.tags.join(';'), tc.automationStatus, `${tc.estimatedTime}m`
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'test-cases.csv'; a.click();
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Test Cases</div>
                    <div className="page-subtitle">Manage all test cases across your projects</div>
                </div>
                <div className="page-header-actions">
            {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', padding: '4px 6px 4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary-light)', marginRight: 4 }}>{selectedIds.size} selected</span>
                    <select className="form-select form-select-sm" style={{ width: 170, fontSize: 12 }} onChange={e => {
                        const destFolderId = e.target.value;
                        if (!destFolderId) return;
                        const destFolder = state.folders.find(f => f.id === destFolderId);
                        selectedIds.forEach(id => {
                            const tc = state.testCases.find(t => t.id === id);
                            if (tc) dispatch({ type: 'UPDATE_TEST_CASE', payload: { ...tc, folderId: destFolderId, module: destFolder?.name || tc.module } });
                        });
                        setSelectedIds(new Set());
                        e.target.value = '';
                        alert(`Successfully moved ${selectedIds.size} test cases to ${destFolder?.name}`);
                    }}>
                        <option value="">📁 Move to folder...</option>
                        {visibleFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />
                    {canDelete && (
                        <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ Delete</button>
                    )}
                </div>
            )}
                    <button className="btn btn-outline" onClick={exportCSV} id="export-csv-btn">📥 Export CSV</button>
                    <button className="btn btn-primary" onClick={openNew} id="new-tc-btn">+ New Test Case</button>
                </div>
            </div>

            {/* Execution Notice */}
            <div style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>ℹ️</span>
                <span style={{ fontSize: 13, color: 'var(--color-info)' }}>
                    Test cases are <strong>managed here</strong> — to <strong>execute</strong> them, go to
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, marginLeft: 6, color: 'var(--color-primary-light)', padding: '1px 8px' }}
                        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'execution' })}>▶️ Test Execution</button>
                    or
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, marginLeft: 6, color: 'var(--color-primary-light)', padding: '1px 8px' }}
                        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'integration' })}>⚡ Integration Runs</button>
                </span>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="form-input"
                        style={{ maxWidth: 280, flex: 1 }}
                        placeholder="🔍 Search by title, ID, or tag..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        id="tc-search"
                    />
                    <select className="form-select" style={{ maxWidth: 150 }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                        <option value="">All Priorities</option>
                        {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select className="form-select" style={{ maxWidth: 160 }} value={filterAutomation} onChange={e => setFilterAutomation(e.target.value)}>
                        <option value="">All Automation</option>
                        {['Manual', 'Automated', 'In Progress'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select className="form-select" style={{ maxWidth: 150 }} value={filterTeam} onChange={e => {
                        setFilterTeam(e.target.value);
                        setFilterFolder('');
                    }}>
                        <option value="">All Teams</option>
                        {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{filteredTCs.length} results</span>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input type="checkbox" className="table-checkbox" checked={selectedIds.size === filteredTCs.length && filteredTCs.length > 0} onChange={toggleSelectAll} />
                                </th>
                                                        <th>TC ID</th>
                                                                <th>Title</th>
                                                                <th>Team</th>
                                                                <th>Priority</th>
                                                                <th>Module</th>
                                                                <th>Automation</th>
                                                                <th>Tags</th>
                                                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTCs.length === 0 ? (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📋</div>
                                            <div className="empty-state-title">No test cases found</div>
                                            <div className="empty-state-desc">Create a new test case or adjust your filters</div>
                                            <button className="btn btn-primary" onClick={openNew}>+ Create Test Case</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTCs.map(tc => (
                                <tr key={tc.id} style={{ cursor: 'pointer' }}>
                                    <td onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" className="table-checkbox" checked={selectedIds.has(tc.id)} onChange={() => toggleSelect(tc.id)} />
                                    </td>
                                    <td onClick={() => setViewTC(tc)}>
                                        <span className="badge badge-muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{tc.tcId}</span>
                                    </td>
                                        <td onClick={() => setViewTC(tc)} style={{ maxWidth: 300, fontWeight: 500 }}>
                                                <div className="truncate">{tc.title}</div>
                                                {tc.description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }} className="truncate">{tc.description}</div>}
                                            </td>
                                            <td onClick={() => setViewTC(tc)}>
                                                <span className="badge badge-muted" style={{ fontSize: 10, fontFamily: 'monospace' }}>{teamByFolderId[tc.folderId]?.name || '—'}</span>
                                            </td>
                                    <td onClick={() => setViewTC(tc)}>
                                        <span className={`badge badge-${getPriorityColor(tc.priority)}`}>{tc.priority}</span>
                                    </td>
                                    <td onClick={() => setViewTC(tc)} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{tc.module || '—'}</td>
                                    <td onClick={() => setViewTC(tc)}>
                                        <span className={`badge badge-${tc.automationStatus === 'Automated' ? 'success' : tc.automationStatus === 'In Progress' ? 'warning' : 'muted'}`}>
                                            {tc.automationStatus}
                                        </span>
                                    </td>
                                    <td onClick={() => setViewTC(tc)}>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {tc.tags.slice(0, 2).map(tag => <span key={tag} className="badge badge-accent" style={{ fontSize: 10 }}>{tag}</span>)}
                                            {tc.tags.length > 2 && <span className="badge badge-muted" style={{ fontSize: 10 }}>+{tc.tags.length - 2}</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tc)} title="Edit">✏️</button>
                                            {canDelete && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(tc.id)} style={{ color: 'var(--color-danger)' }} title="Delete">🗑️</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Modal */}
            {viewTC && (
                <div className="modal-overlay" onClick={() => setViewTC(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <span className="badge badge-muted" style={{ fontFamily: 'monospace' }}>{viewTC.tcId}</span>
                                    <span className={`badge badge-${getPriorityColor(viewTC.priority)}`}>{viewTC.priority}</span>
                                </div>
                                <div className="modal-title">{viewTC.title}</div>
                                {viewTC.description && <div className="modal-subtitle" style={{ marginTop: 4 }}>{viewTC.description}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-outline btn-sm" onClick={() => { openEdit(viewTC); setViewTC(null); }}>✏️ Edit</button>
                                <button className="btn btn-ghost btn-icon" onClick={() => setViewTC(null)}>✕</button>
                            </div>
                        </div>

                        {viewTC.preconditions && (
                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Preconditions</div>
                                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{viewTC.preconditions}</div>
                            </div>
                        )}

                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Test Steps</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {viewTC.steps.map((step, i) => (
                                <div key={step.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary-glow)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', flexShrink: 0, marginTop: 1 }}>
                                            {i + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 6 }}><strong>Action:</strong> {step.action}</div>
                                            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                <strong style={{ color: 'var(--color-success)' }}>Expected:</strong> {step.expectedResult}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {viewTC.tags.map(tag => <span key={tag} className="badge badge-accent">{tag}</span>)}
                        </div>
                        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--color-text-muted)' }}>
                            <span>📅 Created: {new Date(viewTC.createdAt).toLocaleDateString()}</span>
                            <span>⏱️ Est. Time: {viewTC.estimatedTime}m</span>
                            {viewTC.assignee && <span>👤 Assignee: {viewTC.assignee}</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{editTC ? 'Edit Test Case' : 'Create New Test Case'}</div>
                                <div className="modal-subtitle">Define steps, expected results, and metadata</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">TC ID</label>
                                <input className="form-input" value={form.tcId || ''} onChange={e => setForm({ ...form, tcId: e.target.value })} placeholder="TC-001" style={{ fontFamily: 'monospace' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Module</label>
                                <input className="form-input" value={form.module || ''} onChange={e => setForm({ ...form, module: e.target.value })} placeholder="Authentication, Payment, etc." />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Clear, action-oriented test case title" id="tc-title-input" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Additional context and description" rows={2} />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>
                                    {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Team</label>
                                <select className="form-select" value={state.teams.find(t => state.folders.some(f => f.id === form.folderId && f.teamId === t.id))?.id || ''} onChange={e => {
                                    const teamId = e.target.value;
                                    if (!teamId) return;
                                    const folder = state.folders.find(f => f.teamId === teamId && (f.type === 'release' || f.type === 'project')) || state.folders.find(f => f.teamId === teamId);
                                    if (!editTC) {
                                        const newTcId = generateTeamTcId(folder?.id || '', state.folders, state.teams, state.testCases);
                                        setForm({ ...form, folderId: folder?.id || '', tcId: newTcId });
                                    } else {
                                        setForm({ ...form, folderId: folder?.id || '' });
                                    }
                                }}>
                                    <option value="">— Select Team —</option>
                                    {state.teams.filter(t => state.folders.some(f => f.teamId === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Folder/Release</label>
                                <select className="form-select" value={form.folderId} onChange={e => {
                                    const newFolderId = e.target.value;
                                    if (!editTC && newFolderId) {
                                        const newTcId = generateTeamTcId(newFolderId, state.folders, state.teams, state.testCases);
                                        setForm({ ...form, folderId: newFolderId, tcId: newTcId });
                                    } else {
                                        setForm({ ...form, folderId: newFolderId });
                                    }
                                }}>
                                    <option value="">— Select Folder —</option>
                                    {visibleFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Preconditions</label>
                            <textarea className="form-textarea" value={form.preconditions || ''} onChange={e => setForm({ ...form, preconditions: e.target.value })} placeholder="Conditions that must be true before the test starts" rows={2} />
                        </div>

                        {/* Steps */}
                        <div className="form-group">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <label className="form-label" style={{ margin: 0 }}>Test Steps</label>
                                <button className="btn btn-outline btn-sm" onClick={addStep}>+ Add Step</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(form.steps || []).map((step, idx) => (
                                    <div key={step.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-primary-light)', flexShrink: 0, marginTop: 8 }}>
                                                {idx + 1}
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <input className="form-input" placeholder="Action / Step Description" value={step.action} onChange={e => updateStep(idx, 'action', e.target.value)} />
                                                <input className="form-input" placeholder="Expected Result" value={step.expectedResult} onChange={e => updateStep(idx, 'expectedResult', e.target.value)} style={{ borderColor: 'rgba(16,185,129,0.2)' }} />
                                            </div>
                                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeStep(idx)} style={{ color: 'var(--color-danger)', marginTop: 4 }}>✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Tags (comma-separated)</label>
                                <input className="form-input" value={(form.tags || []).join(', ')} onChange={e => setForm({ ...form, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} placeholder="smoke, regression, auth" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Automation Status</label>
                                <select className="form-select" value={form.automationStatus} onChange={e => setForm({ ...form, automationStatus: e.target.value as TestCase['automationStatus'] })}>
                                    <option value="Manual">Manual</option>
                                    <option value="Automated">Automated</option>
                                    <option value="In Progress">In Progress</option>
                                </select>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!form.title?.trim()} id="save-tc-btn">
                                💾 {editTC ? 'Save Changes' : 'Create Test Case'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
