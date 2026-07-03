'use client';

import React, { useState } from 'react';
import { useApp, Requirement, generateId, hasPermission } from '../store/AppContext';

export default function Requirements() {
    const { state, dispatch } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [editReq, setEditReq] = useState<Requirement | null>(null);
    const [form, setForm] = useState({ title: '', description: '', acceptanceCriteria: '', source: 'Manual', folderId: '', assignee: '' });

    const canDelete = hasPermission(state.currentUser, 'delete');
    const allUsers = state.users;
    const releaseFolders = state.folders.filter(f => f.type === 'release' || f.type === 'project');

    const handleSave = () => {
        if (!form.title.trim()) return;
        const now = new Date().toISOString();
        if (editReq) {
            dispatch({ type: 'UPDATE_REQUIREMENT', payload: { ...editReq, ...form } });
        } else {
            dispatch({
                type: 'ADD_REQUIREMENT',
                payload: { id: generateId(), ...form, linkedTestCases: [], createdAt: now },
            });
        }
        setShowModal(false);
        setEditReq(null);
        setForm({ title: '', description: '', acceptanceCriteria: '', source: 'Manual', folderId: '', assignee: '' });
    };

    const openEdit = (req: Requirement) => {
        setEditReq(req);
        setForm({ title: req.title, description: req.description, acceptanceCriteria: req.acceptanceCriteria, source: req.source, folderId: req.folderId || '', assignee: req.assignee || '' });
        setShowModal(true);
    };

    const getAssigneeName = (userId?: string) => {
        if (!userId) return null;
        const user = state.users.find(u => u.id === userId);
        return user ? user.name : userId;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Requirements</div>
                    <div className="page-subtitle">Link business requirements and acceptance criteria to test cases</div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-accent" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'ai-generate' })} id="generate-from-req-btn">
                        🤖 AI Generate TCs
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditReq(null); setForm({ title: '', description: '', acceptanceCriteria: '', source: 'Manual', folderId: '', assignee: '' }); setShowModal(true); }} id="new-req-btn">
                        + New Requirement
                    </button>
                </div>
            </div>

            {state.requirements.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-title">No requirements yet</div>
                        <div className="empty-state-desc">
                            Add business requirements or acceptance criteria from Jira, ServiceNow, or manually.
                            Then use AI to automatically generate test cases from them.
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Requirement</button>
                            <button className="btn btn-accent" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'ai-generate' })}>🤖 AI Generator</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                    {state.requirements.map(req => {
                        const linkedCount = state.testCases.filter(t => t.requirementId === req.id).length;
                        return (
                            <div key={req.id} className="card" style={{ cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span className="badge badge-muted">{req.source}</span>
                                        {req.folderId && <span className="badge badge-primary">{state.folders.find(f => f.id === req.folderId)?.name || req.folderId}</span>}
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{new Date(req.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>{req.title}</div>
                                {req.description && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{req.description}</div>}
                                {req.acceptanceCriteria && (
                                    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Acceptance Criteria</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.6 }}>
                                            {req.acceptanceCriteria.slice(0, 180)}{req.acceptanceCriteria.length > 180 ? '…' : ''}
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span className="badge badge-primary">🔗 {linkedCount} TCs</span>
                                        {req.assignee && <span className="badge badge-accent">👤 {getAssigneeName(req.assignee)}</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(req)}>✏️ Edit</button>
                                        {canDelete && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                                if (confirm('Delete this requirement?')) {
                                                    dispatch({ type: 'DELETE_REQUIREMENT', payload: req.id });
                                                }
                                            }} style={{ color: 'var(--color-danger)' }} title="Delete">🗑️</button>
                                        )}
                                        <button className="btn btn-accent btn-sm" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'ai-generate' })}>🤖 Generate TCs</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{editReq ? 'Edit Requirement' : 'Add Requirement'}</div>
                                <div className="modal-subtitle">Business requirement or acceptance criteria from any source</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Title *</label>
                                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="REQ-001: User Login" id="req-title-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Source</label>
                                <select className="form-select" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                    {['Manual', 'Jira', 'ServiceNow', 'Confluence', 'Word', 'Email', 'Business Analyst'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Folder / Release</label>
                                <select className="form-select" value={form.folderId} onChange={e => setForm({ ...form, folderId: e.target.value })}>
                                    <option value="">— No Folder —</option>
                                    {releaseFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assignee</label>
                                <select className="form-select" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}>
                                    <option value="">— Unassigned —</option>
                                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the requirement..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Acceptance Criteria (BDD or plain text)</label>
                            <textarea className="form-textarea" value={form.acceptanceCriteria} onChange={e => setForm({ ...form, acceptanceCriteria: e.target.value })} rows={5}
                                placeholder="GIVEN the user has valid credentials&#10;WHEN they click Login&#10;THEN they are redirected to the dashboard&#10;AND a session token is created" />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim()} id="save-req-btn">💾 Save Requirement</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
