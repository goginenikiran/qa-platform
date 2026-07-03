'use client';

import React, { useState } from 'react';
import { useApp, User, Team, generateId, Role } from '../store/AppContext';

export default function Teams() {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users');

    // Modals
    const [showUserModal, setShowUserModal] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);

    // Forms
    const [userForm, setUserForm] = useState<Partial<User>>({});
    const [teamForm, setTeamForm] = useState<Partial<Team>>({});

    const isAdmin = state.currentUser?.role === 'Admin';

    if (!isAdmin) {
        return (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Access Denied</div>
                <div style={{ color: 'var(--color-text-muted)' }}>Only Administrators can manage users and teams.</div>
            </div>
        );
    }

    // Save User
    const handleSaveUser = () => {
        if (!userForm.name || !userForm.email || !userForm.role) return;

        if (userForm.id) {
            dispatch({ type: 'UPDATE_USER', payload: userForm as User });
        } else {
            dispatch({
                type: 'ADD_USER',
                payload: {
                    id: generateId(),
                    name: userForm.name,
                    email: userForm.email,
                    role: userForm.role as Role,
                    teamIds: userForm.teamIds || []
                }
            });
        }
        setShowUserModal(false);
        setUserForm({});
    };

    const handleSaveTeam = () => {
        if (!teamForm.name) return;
        if (teamForm.id) {
            dispatch({ type: 'UPDATE_TEAM', payload: teamForm as Team });
        } else {
            dispatch({
                type: 'ADD_TEAM', payload: {
                    id: generateId(),
                    name: teamForm.name,
                    description: teamForm.description || ''
                }
            });
        }
        setShowTeamModal(false);
        setTeamForm({});
    }

    const toggleUserTeam = (teamId: string) => {
        const current = userForm.teamIds || [];
        if (current.includes(teamId)) setUserForm({ ...userForm, teamIds: current.filter(id => id !== teamId) });
        else setUserForm({ ...userForm, teamIds: [...current, teamId] });
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Users & Teams Governance</div>
                    <div className="page-subtitle">Manage roles, permissions, and team folder access</div>
                </div>
                <div className="page-header-actions">
                    {activeTab === 'users' ? (
                        <button className="btn btn-primary" onClick={() => { setUserForm({ role: 'Tester', teamIds: [] }); setShowUserModal(true) }}>+ Add User</button>
                    ) : (
                        <button className="btn btn-primary" onClick={() => { setTeamForm({}); setShowTeamModal(true) }}>+ Create Team</button>
                    )}
                </div>
            </div>

            <div className="tabs">
                <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Users</button>
                <button className={`tab ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>🏗️ Teams</button>
            </div>

            <div className="card">
                {activeTab === 'users' && (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Teams</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.users.map(user => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 600 }}>{user.name} {state.currentUser?.id === user.id && <span className="badge badge-accent" style={{ fontSize: 9, marginLeft: 6 }}>You</span>}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>{user.email}</td>
                                        <td><span className={`badge badge-${user.role === 'Admin' ? 'danger' : user.role === 'Lead' ? 'warning' : 'info'}`}>{user.role}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {user.role === 'Admin' ? <span className="badge badge-success">ALL (Global)</span> :
                                                    user.teamIds.length === 0 ? <span className="badge badge-muted">None</span> :
                                                        user.teamIds.map(tid => {
                                                            const t = state.teams.find(x => x.id === tid);
                                                            return t ? <span key={tid} className="badge badge-muted">{t.name}</span> : null;
                                                        })
                                                }
                                            </div>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setUserForm(user); setShowUserModal(true) }}>Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Team Name</th>
                                    <th>Description</th>
                                    <th>Members</th>
                                    <th>Folders Assigned</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.teams.map(team => {
                                    const membersCount = state.users.filter(u => u.teamIds.includes(team.id)).length;
                                    const foldersCount = state.folders.filter(f => f.teamId === team.id).length;
                                    return (
                                        <tr key={team.id}>
                                            <td style={{ fontWeight: 600 }}>{team.name}</td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>{team.description || '—'}</td>
                                            <td><span className="badge badge-info">👥 {membersCount}</span></td>
                                            <td><span className="badge badge-primary">📁 {foldersCount}</span></td>
                                            <td>
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setTeamForm(team); setShowTeamModal(true) }}>Edit</button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* User Modal */}
            {showUserModal && (
                <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{userForm.id ? 'Edit User' : 'Add User'}</div>
                                <div className="modal-subtitle">Configure user identity and RBAC role</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowUserModal(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <input className="form-input" value={userForm.name || ''} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email Address *</label>
                            <input className="form-input" type="email" value={userForm.email || ''} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Role *</label>
                                <select className="form-select" value={userForm.role || 'Tester'} onChange={e => setUserForm({ ...userForm, role: e.target.value as Role })}>
                                    <option value="Tester">Tester (Execute & report bugs)</option>
                                    <option value="Lead">Lead (Full write, manage test cases)</option>
                                    <option value="Admin">Admin (Global access)</option>
                                </select>
                            </div>
                        </div>

                        {userForm.role !== 'Admin' && (
                            <div className="form-group">
                                <label className="form-label">Assign Teams</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', border: '1px solid var(--color-border)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
                                    {state.teams.map(t => (
                                        <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                            <input type="checkbox" className="table-checkbox" checked={(userForm.teamIds || []).includes(t.id)} onChange={() => toggleUserTeam(t.id)} />
                                            <span style={{ fontSize: 13 }}>{t.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowUserModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveUser} disabled={!userForm.name || !userForm.email}>💾 Save User</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Modal */}
            {showTeamModal && (
                <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{teamForm.id ? 'Edit Team' : 'Create Team'}</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowTeamModal(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Team Name *</label>
                            <input className="form-input" value={teamForm.name || ''} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={teamForm.description || ''} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowTeamModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveTeam} disabled={!teamForm.name}>💾 Save Team</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
