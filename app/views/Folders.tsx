'use client';

import React, { useState } from 'react';
import { useApp, Folder, TestCase, generateId, getPriorityColor } from '../store/AppContext';

const FOLDER_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export default function Folders() {
    const { state, dispatch } = useApp();
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['f1', 'f5']));
    const [folderForm, setFolderForm] = useState({ name: '', description: '', parentId: '', type: 'module' as Folder['type'], color: FOLDER_COLORS[0], teamId: '', startDate: '', endDate: '' });
    const [importText, setImportText] = useState('');
    const [editFolder, setEditFolder] = useState<Folder | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ message: string; detail?: string; onConfirm: () => void } | null>(null);

    const isAdmin = state.currentUser?.role === 'Admin';
    const canViewFolder = (f: Folder) => isAdmin || !f.teamId || state.currentUser?.teamIds.includes(f.teamId);

    // Filter folders based on RBAC
    const allVisibleFolders = state.folders.filter(canViewFolder);
    const rootFolders = allVisibleFolders.filter(f => !f.parentId);
    const getChildren = (parentId: string) => allVisibleFolders.filter(f => f.parentId === parentId);
    const getTCCount = (folderId: string) => state.testCases.filter(t => t.folderId === folderId).length;

    const toggleExpand = (id: string) => {
        const next = new Set(expandedFolders);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedFolders(next);
    };

    const handleSaveFolder = () => {
        if (!folderForm.name.trim()) return;
        if (editFolder) {
            dispatch({ type: 'UPDATE_FOLDER', payload: { ...editFolder, ...folderForm } });
        } else {
            dispatch({
                type: 'ADD_FOLDER',
                payload: {
                    id: generateId(), name: folderForm.name, description: folderForm.description,
                    parentId: folderForm.parentId || undefined, type: folderForm.type,
                    color: folderForm.color, createdAt: new Date().toISOString(), teamId: folderForm.teamId || undefined,
                    startDate: folderForm.startDate || undefined,
                    endDate: folderForm.endDate || undefined,
                },
            });
        }
        setShowNewFolder(false);
        setEditFolder(null);
        setFolderForm({ name: '', description: '', parentId: '', type: 'module', color: FOLDER_COLORS[0], teamId: '', startDate: '', endDate: '' });
    };

    const handleDeleteFolder = (id: string) => {
        const folder = state.folders.find(f => f.id === id);
        const name = folder?.name || 'this folder';
        setConfirmAction({
            message: `Delete "${name}" and ALL subfolders? Test cases will be unassigned (kept in Test Cases module).`,
            onConfirm: () => {
                dispatch({ type: 'DELETE_FOLDER', payload: id });
                if (selectedFolder?.id === id) setSelectedFolder(null);
                setConfirmAction(null);
            }
        });
    };

    const handleImport = () => {
        if (!importText.trim() || !selectedFolder) return;
        // Parse CSV-like or plain text test cases
        const lines = importText.trim().split('\n').filter(l => l.trim());
        const newTCs: TestCase[] = lines.map((line, i) => {
            const parts = line.split(',').map(p => p.trim());
            const title = parts[0] || `Imported Test Case ${i + 1}`;
            const priority = (['Critical', 'High', 'Medium', 'Low'].includes(parts[1]) ? parts[1] : 'Medium') as TestCase['priority'];
            const tcCount = state.testCases.length + i + 1;
            return {
                id: generateId(),
                tcId: `TC-${String(tcCount).padStart(3, '0')}`,
                title, priority,
                description: parts[2] || '',
                module: selectedFolder.name,
                folderId: selectedFolder.id,
                status: 'Not Run',
                preconditions: '',
                steps: [{ id: generateId(), stepNumber: 1, action: 'Verify as per title', expectedResult: 'Expected outcome as per acceptance criteria' }],
                tags: [],
                createdBy: 'Admin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                estimatedTime: 5,
                automationStatus: 'Manual',
            };
        });
        dispatch({ type: 'IMPORT_TEST_CASES', payload: newTCs });
        setImportText('');
        setShowImport(false);
    };

    const selectedFolderTCs = selectedFolder
        ? state.testCases.filter(t => t.folderId === selectedFolder.id)
        : [];

    const FolderNode = ({ folder, depth = 0 }: { folder: Folder; depth?: number }) => {
        const children = getChildren(folder.id);
        const tcCount = getTCCount(folder.id);
        const isExpanded = expandedFolders.has(folder.id);
        const isSelected = selectedFolder?.id === folder.id;
        const hasChildren = children.length > 0;

        return (
            <div style={{ marginLeft: depth * 16 }}>
                <div
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: isSelected ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                        marginBottom: 2, transition: 'all 0.15s',
                    }}
                    onClick={() => { setSelectedFolder(folder); if (hasChildren) toggleExpand(folder.id); }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                    <span style={{ fontSize: 12, opacity: 0.6, width: 16, textAlign: 'center' }}>
                        {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
                    </span>
                    <span style={{ fontSize: 16 }}>
                        {folder.type === 'project' ? '🗂️' : folder.type === 'release' ? '🏷️' : '📁'}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--color-primary-light)' : 'var(--color-text-primary)' }}>
                        {folder.name}
                    </span>
                    {tcCount > 0 && <span className="badge badge-primary" style={{ fontSize: 10 }}>{tcCount}</span>}
                    <div style={{ display: 'flex', gap: 4, opacity: 0 }} className="folder-actions">
                        {isAdmin && (
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11 }}
                                                                onClick={e => { e.stopPropagation(); setEditFolder(folder); setFolderForm({ name: folder.name, description: folder.description, parentId: folder.parentId || '', type: folder.type, color: folder.color, teamId: folder.teamId || '', startDate: folder.startDate || '', endDate: folder.endDate || '' }); setShowNewFolder(true); }}>
                                ✏️
                            </button>
                        )}
                        {isAdmin && (
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--color-danger)' }}
                                onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                                🗑️
                            </button>
                        )}
                    </div>
                </div>
                {isExpanded && children.map(child => <FolderNode key={child.id} folder={child} depth={depth + 1} />)}
                <style>{`.folder-actions { opacity: 0; } div:hover > .folder-actions { opacity: 1; }`}</style>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Releases & Folders</div>
                    <div className="page-subtitle">Organize test cases by project, release, and module</div>
                </div>
                <div className="page-header-actions">
                    {selectedFolder && (
                        <button className="btn btn-outline" onClick={() => setShowImport(true)} id="import-tc-btn">
                            📤 Import Test Cases
                        </button>
                    )}
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={() => { setEditFolder(null); setFolderForm({ name: '', description: '', parentId: '', type: 'module', color: FOLDER_COLORS[0], teamId: '', startDate: '', endDate: '' }); setShowNewFolder(true); }} id="new-folder-btn">
                            + New Folder
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
                {/* Tree Panel */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <div className="card-header">
                        <div className="card-title" style={{ fontSize: 13 }}>Project Tree</div>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{state.folders.length} folders</span>
                    </div>
                    <div>
                        {rootFolders.map(f => <FolderNode key={f.id} folder={f} />)}
                    </div>
                </div>

                {/* Folder Detail */}
                <div>
                    {selectedFolder ? (
                        <>
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: `${selectedFolder.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: `1px solid ${selectedFolder.color}40` }}>
                                        {selectedFolder.type === 'project' ? '🗂️' : selectedFolder.type === 'release' ? '🏷️' : '📁'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedFolder.name}</div>
                                            {selectedFolder.teamId && (
                                                <span className="badge badge-info">{state.teams.find(t => t.id === selectedFolder.teamId)?.name}</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>{selectedFolder.description || 'No description'}</div>
                                        {(selectedFolder.startDate || selectedFolder.endDate) && (
                                            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                {selectedFolder.startDate && <span>📅 Start: {new Date(selectedFolder.startDate).toLocaleDateString()}</span>}
                                                {selectedFolder.endDate && <span>🏁 End: {new Date(selectedFolder.endDate).toLocaleDateString()}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary-light)' }}>{selectedFolderTCs.length}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Test Cases</div>
                                    </div>

                                    {isAdmin && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--color-border)', paddingLeft: 16, marginLeft: 8 }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => { setEditFolder(selectedFolder); setFolderForm({ name: selectedFolder.name, description: selectedFolder.description, parentId: selectedFolder.parentId || '', type: selectedFolder.type, color: selectedFolder.color, teamId: selectedFolder.teamId || '', startDate: selectedFolder.startDate || '', endDate: selectedFolder.endDate || '' }); setShowNewFolder(true); }}>
                                                ✏️ Edit Folder
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFolder(selectedFolder.id)}>
                                                🗑️ Delete Folder
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TCs in folder */}
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Test Cases</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>📤 Import</button>
                                        <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'testcases' })}>+ Add Test Case</button>
                                    </div>
                                </div>
                                {selectedFolderTCs.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📋</div>
                                        <div className="empty-state-title">No test cases yet</div>
                                        <div className="empty-state-desc">Import from Excel or create new test cases for this folder</div>
                                        <button className="btn btn-primary" onClick={() => setShowImport(true)}>📤 Import Test Cases</button>
                                    </div>
                                ) : (
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr><th>ID</th><th>Title</th><th>Priority</th><th>Automation</th><th style={{ width: 60, textAlign: 'center' }}>Actions</th></tr>
                                            </thead>
                                            <tbody>
                                                {selectedFolderTCs.map(tc => (
                                                    <tr key={tc.id}>
                                                        <td><span className="badge badge-muted font-mono" style={{ fontSize: 11 }}>{tc.tcId}</span></td>
                                                        <td style={{ fontWeight: 500, maxWidth: 280 }} className="truncate">{tc.title}</td>
                                                        <td><span className={`badge badge-${getPriorityColor(tc.priority)}`}>{tc.priority}</span></td>
                                                        <td><span className="badge badge-muted">{tc.automationStatus}</span></td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button className="btn btn-ghost btn-sm" title="Remove from this folder"
                                                                style={{ padding: '2px 8px', fontSize: 14, color: 'var(--color-danger)', lineHeight: 1 }}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    const tcLabel = tc.tcId;
                                                                    const rootProject = state.folders.find(f => f.type === 'project');
                                                                    setConfirmAction({
                                                                        message: `Remove ${tcLabel} from "${selectedFolder?.name}"?`,
                                                                        detail: 'Test case will be moved to the project root and kept for reuse.',
                                                                        onConfirm: () => {
                                                                            dispatch({ type: 'UPDATE_TEST_CASE', payload: { ...tc, folderId: rootProject?.id || tc.folderId } });
                                                                            setConfirmAction(null);
                                                                        }
                                                                    });
                                                                }}>
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state-icon">📁</div>
                                <div className="empty-state-title">Select a folder</div>
                                <div className="empty-state-desc">Click on a folder in the tree to view its test cases and details</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New/Edit Folder Modal */}
            {showNewFolder && (
                <div className="modal-overlay" onClick={() => setShowNewFolder(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{editFolder ? 'Edit Folder' : 'Create New Folder'}</div>
                                <div className="modal-subtitle">Organize your test cases by project, release, or module</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewFolder(false)}>✕</button>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Folder Name *</label>
                                <input className="form-input" value={folderForm.name} onChange={e => setFolderForm({ ...folderForm, name: e.target.value })} placeholder="e.g. Release 3.0" id="folder-name-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select className="form-select" value={folderForm.type} onChange={e => setFolderForm({ ...folderForm, type: e.target.value as Folder['type'] })}>
                                    <option value="project">Project</option>
                                    <option value="release">Release</option>
                                    <option value="module">Module</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Start Date</label>
                                <input className="form-input" type="date" value={folderForm.startDate} onChange={e => setFolderForm({ ...folderForm, startDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">End Date</label>
                                <input className="form-input" type="date" value={folderForm.endDate} onChange={e => setFolderForm({ ...folderForm, endDate: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Parent Folder</label>
                            <select className="form-select" value={folderForm.parentId} onChange={e => setFolderForm({ ...folderForm, parentId: e.target.value })}>
                                <option value="">— Root (No parent) —</option>
                                {allVisibleFolders.filter(f => f.id !== editFolder?.id).map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {isAdmin && (
                            <div className="form-group">
                                <label className="form-label">Assign to Team (RBAC)</label>
                                <select className="form-select" value={folderForm.teamId} onChange={e => setFolderForm({ ...folderForm, teamId: e.target.value })}>
                                    <option value="">— Global Access (All Teams) —</option>
                                    {state.teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={folderForm.description} onChange={e => setFolderForm({ ...folderForm, description: e.target.value })} placeholder="Describe this folder..." rows={2} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Color</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {FOLDER_COLORS.map(c => (
                                    <div key={c} onClick={() => setFolderForm({ ...folderForm, color: c })}
                                        style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: folderForm.color === c ? '2px solid white' : '2px solid transparent', transform: folderForm.color === c ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.15s' }} />
                                ))}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowNewFolder(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveFolder} id="save-folder-btn">💾 {editFolder ? 'Save Changes' : 'Create Folder'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImport && selectedFolder && (
                <div className="modal-overlay" onClick={() => setShowImport(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">Import Test Cases</div>
                                <div className="modal-subtitle">Import into: <strong style={{ color: 'var(--color-primary-light)' }}>{selectedFolder.name}</strong></div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowImport(false)}>✕</button>
                        </div>

                        <div className="ai-panel" style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                                📌 Format: One test case per line. Columns: Title, Priority, Description
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                Verify login with valid credentials, Critical, Test user auth flow<br />
                                Verify login failure with wrong password, High<br />
                                Verify SSO login, Medium, Azure AD integration test
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Paste Test Cases (CSV format)</label>
                            <textarea
                                className="form-textarea"
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                placeholder="Test Case Title, Priority, Description..."
                                rows={8}
                                style={{ fontFamily: 'monospace', fontSize: 12 }}
                                id="import-textarea"
                            />
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                            💡 Tip: You can also export from Excel as CSV and paste here. {importText.split('\n').filter(l => l.trim()).length} rows detected.
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowImport(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleImport} disabled={!importText.trim()} id="confirm-import-btn">
                                📤 Import {importText.split('\n').filter(l => l.trim()).length} Test Cases
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal */}
            {confirmAction && (
                <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title" style={{ fontSize: 16 }}>📂 Remove from Folder</div>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: '8px 0 4px' }}>
                            {confirmAction.message}
                        </p>
                        {confirmAction.detail && (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: '0 0 24px' }}>
                                {confirmAction.detail}
                            </p>
                        )}
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setConfirmAction(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={confirmAction.onConfirm}>📂 Remove from Folder</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
