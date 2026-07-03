'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp, Ticket, TestCase, Folder, AppState, generateId, getPriorityColor, getStatusColor } from '../store/AppContext';

const PLATFORM_ICONS: Record<string, string> = {
    jira: '🔷',
    servicenow: '❄️',
    github: '🐙',
    azure: '☁️',
    manual: '🔧',
};

const VERIFICATION_COLORS = {
    Verified: '#10b981',
    Failed: '#ef4444',
    'Partially Verified': '#f59e0b',
    Unverified: '#64748b',
};

export default function Tickets() {
    const { state, dispatch } = useApp();
    const [searchQ, setSearchQ] = useState('');
    const [filterPlatform, setFilterPlatform] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterVerification, setFilterVerification] = useState('');
    const [filterTeam, setFilterTeam] = useState('');
    const [folderFilter, setFolderFilter] = useState<string>(''); // selected folder ID for filtering
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(state.folders.map(f => f.id)));

    const getTcTeamId = (tc: TestCase): string | undefined => {
        const folder = state.folders.find(f => f.id === tc.folderId);
        return folder?.teamId;
    };

    const getLinkedTCsForTicket = (ticket: Ticket) => {
        const ticketTeamIds = ticket.teamIds || [];
        return state.testCases.filter(tc => {
            if (!ticket.linkedTestCases.includes(tc.id)) return false;
            const tcTeamId = getTcTeamId(tc);
            return ticketTeamIds.length === 0 || ticketTeamIds.includes(tcTeamId || '');
        });
    };
    const filteredFolderIds = useMemo(() => {
        if (!folderFilter) return null;
        const ids: string[] = [folderFilter];
        const collect = (parentId: string) => {
            state.folders.forEach(f => { if (f.parentId === parentId) { ids.push(f.id); collect(f.id); } });
        };
        collect(folderFilter);
        return new Set(ids);
    }, [folderFilter, state.folders]);
    const rootFolders = useMemo(() => state.folders.filter(f => !f.parentId), [state.folders]);
    
    // Modal states
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState<string | null>(null); // Ticket ID
    const [editTicket, setEditTicket] = useState<Ticket | null>(null);
    const [ticketForm, setTicketForm] = useState<Partial<Ticket>>({
        ticketId: '', title: '', description: '', priority: 'Medium', status: 'Open', platform: 'manual', linkedTestCases: [], folderId: '', teamIds: []
    });
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderParent, setNewFolderParent] = useState('');
    const [newFolderTeam, setNewFolderTeam] = useState('');

    // Sync and AI simulation states
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [showAISuggestions, setShowAISuggestions] = useState(false);
    const [approvedAIRecommendations, setApprovedAIRecommendations] = useState<Set<string>>(new Set());
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // Selected tickets for batch verification execution run
    const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());

    // Generate test cases from ticket
    const [genTicketId, setGenTicketId] = useState<string | null>(null);
    const [genFolderId, setGenFolderId] = useState('');

    const generateTCsFromTicket = () => {
        if (!genTicketId || !genFolderId) return;
        const ticket = state.tickets.find(t => t.id === genTicketId);
        if (!ticket) return;
        const folder = state.folders.find(f => f.id === genFolderId);
        const team = folder?.teamId ? state.teams.find(t => t.id === folder.teamId) : null;
        const prefix = team ? team.name : 'TC';
        const now = new Date().toISOString();

        const scenarios = [
            { title: `${ticket.title} - Happy Path`, desc: `Verify the primary success scenario for: ${ticket.title}` },
            { title: `${ticket.title} - Negative Test`, desc: `Verify error handling for: ${ticket.description?.slice(0, 100) || ticket.title}` },
            { title: `${ticket.title} - Edge Case`, desc: `Verify edge case behavior for: ${ticket.title}` },
        ];

        // Count existing TCs with this team prefix across all team folders
        const teamFolderIds = folder?.teamId
            ? state.folders.filter(f => f.teamId === folder.teamId).map(f => f.id)
            : [genFolderId];
        let count = state.testCases.filter(tc =>
            teamFolderIds.includes(tc.folderId) ||
            tc.tcId.toUpperCase().startsWith(prefix.toUpperCase() + '-TC')
        ).length;

        const newTcIds: string[] = [];
        scenarios.forEach(s => {
            count += 1;
            const tcId = `${prefix}-TC${String(count).padStart(2, '0')}`;
            const newId = generateId();
            newTcIds.push(newId);
            dispatch({
                type: 'ADD_TEST_CASE',
                payload: {
                    id: newId,
                    tcId,
                    title: s.title,
                    description: s.desc,
                    module: folder?.name || '',
                    folderId: genFolderId,
                    priority: 'Medium',
                    status: 'Not Run',
                    preconditions: ticket.description || '',
                    steps: [{ id: generateId(), stepNumber: 1, action: 'Execute the test scenario', expectedResult: 'Expected behavior matches specification' }],
                    tags: [...(ticket.platform ? [ticket.platform] : [])],
                    assignee: ticket.assignee,
                    createdBy: state.currentUser?.name || 'System',
                    createdAt: now,
                    updatedAt: now,
                    estimatedTime: 10,
                    automationStatus: 'Manual',
                    ticketIds: [ticket.id],
                },
            });
        });

        // Link ticket to generated TCs
        dispatch({ type: 'UPDATE_TICKET', payload: { ...ticket, linkedTestCases: [...(ticket.linkedTestCases || []), ...newTcIds] } });

        setGenTicketId(null);
        setGenFolderId('');
        alert('3 test cases generated and linked to ticket');
    };

    const closeTicketModal = useCallback(() => {
        setShowTicketModal(false);
        setEditTicket(null);
    }, []);

    const closeLinkModal = useCallback(() => {
        setShowLinkModal(null);
    }, []);

    useEffect(() => {
        if (!showTicketModal && !showLinkModal) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showTicketModal) closeTicketModal();
                if (showLinkModal) closeLinkModal();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [showTicketModal, showLinkModal, closeTicketModal, closeLinkModal]);

    // Resolve verification status of a ticket based on linked test case statuses
    const getVerificationStatus = useCallback((ticket: Ticket): 'Verified' | 'Failed' | 'Partially Verified' | 'Unverified' => {
        if (!ticket.linkedTestCases || ticket.linkedTestCases.length === 0) {
            return 'Unverified';
        }
        
        const linkedTCs = state.testCases.filter(tc => ticket.linkedTestCases.includes(tc.id));
        if (linkedTCs.length === 0) return 'Unverified';

        const statuses = linkedTCs.map(tc => tc.status);
        
        if (statuses.includes('Fail')) {
            return 'Failed';
        }
        
        const passedCount = statuses.filter(s => s === 'Pass').length;
        if (passedCount === linkedTCs.length) {
            return 'Verified';
        }
        
        if (passedCount > 0) {
            return 'Partially Verified';
        }
        
        return 'Unverified';
    }, [state.testCases]);

    // Calculate ticket-level statistics
    const stats = useMemo(() => {
        const total = state.tickets.length;
        let verified = 0;
        let failed = 0;
        let partial = 0;
        let unverified = 0;

        state.tickets.forEach(ticket => {
            const vStatus = getVerificationStatus(ticket);
            if (vStatus === 'Verified') verified++;
            else if (vStatus === 'Failed') failed++;
            else if (vStatus === 'Partially Verified') partial++;
            else unverified++;
        });

        const verificationRate = total > 0 ? Math.round((verified / total) * 100) : 0;
        return { total, verified, failed, partial, unverified, verificationRate };
    }, [state.tickets, getVerificationStatus]);

    // Pie chart distribution
    const chartData = [
        { name: 'Verified', value: stats.verified },
        { name: 'Failed', value: stats.failed },
        { name: 'Partially Verified', value: stats.partial },
        { name: 'Unverified', value: stats.unverified },
    ].filter(d => d.value > 0);

    // Filter tickets
    const filteredTickets = useMemo(() => {
        return state.tickets.filter(t => {
            if (filterPlatform && t.platform !== filterPlatform) return false;
            if (filterStatus && t.status !== filterStatus) return false;
            if (filterTeam && !(t.teamIds || []).includes(filterTeam)) return false;
            if (filterVerification) {
                const vStatus = getVerificationStatus(t);
                if (vStatus !== filterVerification) return false;
            }
            if (filteredFolderIds) {
                const tcFolders = new Set(state.testCases.filter(tc => t.linkedTestCases.includes(tc.id)).map(tc => tc.folderId));
                if (![...tcFolders].some(fid => filteredFolderIds.has(fid))) return false;
            }
            if (searchQ) {
                const q = searchQ.toLowerCase();
                const matchId = t.ticketId.toLowerCase().includes(q);
                const matchTitle = t.title.toLowerCase().includes(q);
                const matchDesc = t.description.toLowerCase().includes(q);
                if (!matchId && !matchTitle && !matchDesc) return false;
            }
            return true;
        });
    }, [state.tickets, filterPlatform, filterStatus, filterVerification, searchQ, getVerificationStatus, state.testCases, filteredFolderIds]);

    // AI recommendation simulation logic
    const aiRecommendations = useMemo(() => {
        const recommendations: { id: string; ticket: Ticket; tc: TestCase; score: number; reason: string }[] = [];
        
        state.tickets.forEach(t => {
            state.testCases.forEach(tc => {
                // Skip if already linked
                if (t.linkedTestCases.includes(tc.id)) return;

                let score = 0;
                const reasons: string[] = [];

                // Compare keywords in titles/descriptions
                const tWords = (t.title + ' ' + t.description).toLowerCase();
                const tcWords = (tc.title + ' ' + tc.description).toLowerCase();

                const keywords = ['login', 'auth', 'sso', 'mfa', 'stripe', 'payment', 'checkout', 'card', 'error', 'redirect'];
                keywords.forEach(word => {
                    if (tWords.includes(word) && tcWords.includes(word)) {
                        score += 30;
                        reasons.push(`Matched keyword "${word}"`);
                    }
                });

                // Extra matching for module and priority
                if (tc.module && t.description.toLowerCase().includes(tc.module.toLowerCase())) {
                    score += 20;
                    reasons.push(`Matched module "${tc.module}"`);
                }

                if (score >= 30) {
                    recommendations.push({
                        id: `${t.id}-${tc.id}`,
                        ticket: t,
                        tc,
                        score: Math.min(score, 98),
                        reason: reasons.join(', '),
                    });
                }
            });
        });

        return recommendations.sort((a, b) => b.score - a.score);
    }, [state.tickets, state.testCases]);

    // Handlers
    const openNewTicket = () => {
        setEditTicket(null);
        setTicketForm({
            ticketId: `MANUAL-${state.tickets.length + 101}`,
            title: '',
            description: '',
            priority: 'Medium',
            status: 'Open',
            platform: 'manual',
            linkedTestCases: [],
            folderId: '',
            teamIds: [],
        });
        setShowTicketModal(true);
    };

    const openEditTicket = (ticket: Ticket) => {
        setEditTicket(ticket);
        setTicketForm({ ...ticket });
        setShowTicketModal(true);
    };

    const handleSaveTicket = () => {
        if (!ticketForm.title?.trim() || !ticketForm.ticketId?.trim()) return;
        const now = new Date().toISOString();
        if (editTicket) {
            dispatch({
                type: 'UPDATE_TICKET',
                payload: { ...editTicket, ...ticketForm, updatedAt: now } as Ticket,
            });
        } else {
            dispatch({
                type: 'ADD_TICKET',
                payload: {
                    ...ticketForm,
                    id: generateId(),
                    createdAt: now,
                    updatedAt: now,
                } as Ticket,
            });
        }
        setShowTicketModal(false);
    };

    const handleDeleteTicket = (id: string) => {
        if (confirm('Are you sure you want to delete this ticket linkage?')) {
            dispatch({ type: 'DELETE_TICKET', payload: id });
        }
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        dispatch({
            type: 'ADD_FOLDER',
            payload: {
                id: generateId(),
                name: newFolderName.trim(),
                description: '',
                parentId: newFolderParent || undefined,
                type: newFolderParent ? 'module' : 'project',
                color: '#3b82f6',
                createdAt: new Date().toISOString(),
                teamId: newFolderTeam || undefined,
            },
        });
        setNewFolderName('');
        setNewFolderParent('');
        setNewFolderTeam('');
        setShowNewFolder(false);
    };

    const handleLinkToggle = (ticketId: string, testCaseId: string, currentlyLinked: boolean) => {
        if (currentlyLinked) {
            dispatch({ type: 'UNLINK_TC_FROM_TICKET', payload: { ticketId, testCaseId } });
        } else {
            dispatch({ type: 'LINK_TC_TO_TICKET', payload: { ticketId, testCaseId } });
        }
    };

    const handleSyncTickets = async () => {
        if (syncing) return;
        setSyncing(true);
        setSyncProgress(10);

        const currentState = stateRef.current;
        const activeIntegrations = currentState.integrations.filter(i => i.status === 'connected');

        if (activeIntegrations.length === 0) {
            // No connected integrations — try API anyway for mock data
            setSyncing(false);
            alert('No connected integrations found. Go to Integrations page to configure connections first.');
            return;
        }

        let allNewTickets: Ticket[] = [];
        let syncedCount = 0;

        for (let i = 0; i < activeIntegrations.length; i++) {
            const integration = activeIntegrations[i];
            setSyncProgress(Math.round(((i) / activeIntegrations.length) * 80) + 10);

            try {
                const res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: integration.type,
                        config: integration.config,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.tickets) {
                        allNewTickets = [...allNewTickets, ...data.tickets];
                        syncedCount += data.count || data.tickets.length;
                    }
                }

                // Update integration last sync date
                dispatch({
                    type: 'UPDATE_INTEGRATION',
                    payload: { ...integration, lastSync: new Date().toISOString() },
                });
            } catch {
                // Continue with next integration
            }
        }

        setSyncProgress(100);

        if (allNewTickets.length > 0) {
            dispatch({ type: 'SYNC_INTEGRATION_TICKETS', payload: allNewTickets });
        }

        setSyncing(false);
        alert(`Synchronization complete! Pulled ${syncedCount} tickets from ${activeIntegrations.length} integration(s).`);
    };

    const handleAcceptAIRecommendation = (recId: string, ticketId: string, testCaseId: string) => {
        dispatch({ type: 'LINK_TC_TO_TICKET', payload: { ticketId, testCaseId } });
        setApprovedAIRecommendations(prev => {
            const next = new Set(prev);
            next.add(recId);
            return next;
        });
    };

    // Execute run preloaded with linked test cases from selected tickets
    const handleLaunchVerificationRun = () => {
        if (selectedTicketIds.size === 0) return;
        
        // Accumulate unique test case IDs
        const tcIdsToRun = new Set<string>();
        state.tickets.forEach(ticket => {
            if (selectedTicketIds.has(ticket.id)) {
                ticket.linkedTestCases.forEach(id => tcIdsToRun.add(id));
            }
        });

        if (tcIdsToRun.size === 0) {
            alert('Selected tickets do not have any linked test cases to execute.');
            return;
        }

        // Build execution run payload
        const runId = generateId();
        const ticketNames = state.tickets
            .filter(t => selectedTicketIds.has(t.id))
            .map(t => t.ticketId)
            .join(', ');
        
        const newRun = {
            id: runId,
            name: `Verification Run [${ticketNames}]`,
            folderId: 'f1', // Root project folder
            testCases: Array.from(tcIdsToRun),
            results: {},
            startedAt: new Date().toISOString(),
            createdBy: state.currentUser?.name || 'Admin',
            status: 'In Progress' as const,
            environment: 'Staging',
        };

        dispatch({ type: 'ADD_EXECUTION_RUN', payload: newRun });
        dispatch({ type: 'SET_ACTIVE_RUN', payload: runId });
        dispatch({ type: 'SET_VIEW', payload: 'execution' });
    };

    const toggleTicketSelection = (id: string) => {
        setSelectedTicketIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllTickets = () => {
        if (selectedTicketIds.size === filteredTickets.length) {
            setSelectedTicketIds(new Set());
        } else {
            setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">🎫 Tickets & Requirements Linking</div>
                    <div className="page-subtitle">Track quality matrix metrics and sync external issue tracking tickets directly to test verification flows</div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-outline" onClick={() => setShowAISuggestions(!showAISuggestions)} id="ai-recs-toggle-btn">
                        🤖 AI Link Suggestions {aiRecommendations.length > 0 && !showAISuggestions && <span style={{ background: 'var(--color-accent)', borderRadius: '50%', padding: '2px 6px', fontSize: 10, color: 'white', marginLeft: 4 }}>{aiRecommendations.length}</span>}
                    </button>
                    <button className="btn btn-outline" onClick={handleSyncTickets} disabled={syncing} id="sync-tickets-btn">
                        {syncing ? `🔄 Syncing (${syncProgress}%)` : '🔌 Sync Tickets'}
                    </button>
                    <button className="btn btn-primary" onClick={openNewTicket} id="new-ticket-btn">
                        + Link New Ticket
                    </button>
                </div>
            </div>

            {/* Sync Progress Bar */}
            {syncing && (
                <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--color-primary-light)', width: `${syncProgress}%`, transition: 'width 0.2s ease-out' }} />
                </div>
            )}

            {/* AI Recommendations Panel */}
            {showAISuggestions && (
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.08) 100%)', border: '1px solid rgba(139,92,246,0.25)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 24 }}>🤖</span>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>AI-Powered Smart Link Recommendations</div>
                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Cognitive indexing mapping ticket summaries to test case structures</div>
                            </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAISuggestions(false)}>✕ Close</button>
                    </div>

                    {aiRecommendations.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                            No high-confidence AI recommendations found. Try adding more tickets or test cases!
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
                            {aiRecommendations.map(rec => {
                                const isApproved = approvedAIRecommendations.has(rec.id);
                                return (
                                    <div key={rec.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: isApproved ? 0.6 : 1 }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-primary-light)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                                    {rec.ticket.ticketId}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>
                                                    ✨ Match Score: {rec.score}%
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{rec.ticket.title}</div>
                                            
                                            <div style={{ margin: '8px 0', borderLeft: '2px solid rgba(139,92,246,0.4)', paddingLeft: 8, fontSize: 12 }}>
                                                <div style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Map To:</div>
                                                <div style={{ color: 'var(--color-text-primary)', marginTop: 2 }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 2, marginRight: 4 }}>{rec.tc.tcId}</span>
                                                    {rec.tc.title}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 12 }}>
                                                Reason: {rec.reason}
                                            </div>
                                        </div>
                                        
                                        <button 
                                            className={`btn btn-sm ${isApproved ? 'btn-outline' : 'btn-primary'}`} 
                                            style={{ width: '100%' }}
                                            disabled={isApproved}
                                            onClick={() => handleAcceptAIRecommendation(rec.id, rec.ticket.id, rec.tc.id)}
                                        >
                                            {isApproved ? '✅ Link Applied' : '🔗 Approve Mapping Link'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Folder Tree Sidebar + Main Content */}
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ height: 'fit-content', maxHeight: 400, overflowY: 'auto' }}>
                    <div className="card-header">
                        <div className="card-title" style={{ fontSize: 13 }}>📂 Folders</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {folderFilter && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setFolderFilter('')}>✕</button>}
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setShowNewFolder(!showNewFolder)}>{showNewFolder ? '✕' : '+ New'}</button>
                        </div>
                    </div>
                    {showNewFolder && (
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Folder name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }} />
                            <select className="form-select" style={{ fontSize: 12, padding: '4px 8px' }} value={newFolderParent} onChange={e => setNewFolderParent(e.target.value)}>
                                <option value="">Top-level folder</option>
                                {state.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <select className="form-select" style={{ fontSize: 12, padding: '4px 8px' }} value={newFolderTeam} onChange={e => setNewFolderTeam(e.target.value)}>
                                <option value="">No team (generic)</option>
                                {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={handleCreateFolder} disabled={!newFolderName.trim()}>+ Create</button>
                        </div>
                    )}
                    <div>
                        <div
                            style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: !folderFilter ? 'rgba(59,130,246,0.1)' : 'transparent', fontSize: 13, fontWeight: !folderFilter ? 600 : 400, color: !folderFilter ? 'var(--color-primary-light)' : 'var(--color-text-primary)', marginBottom: 2 }}
                            onClick={() => setFolderFilter('')}
                        >📋 All Tickets</div>
                        {rootFolders.map(f => <FolderTreeNode key={f.id} folder={f} depth={0} state={state} folderFilter={folderFilter} setFolderFilter={setFolderFilter} expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders} dispatch={dispatch} />)}
                    </div>
                </div>
                <div>

            {/* Dashboard & Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>
                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #3b82f6, #8b5cf6)' } as React.CSSProperties}>
                        <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>🎫</div>
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-label">Total Linked Tickets</div>
                        <div className="stat-change up">From integrations & manuals</div>
                    </div>
                    <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #10b981, #059669)' } as React.CSSProperties}>
                        <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>✔️</div>
                        <div className="stat-value">{stats.verificationRate}%</div>
                        <div className="stat-label">Verification Rate</div>
                        <div className="stat-change up">{stats.verified} fully verified tickets</div>
                    </div>
                    <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #ef4444, #dc2626)' } as React.CSSProperties}>
                        <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>❌</div>
                        <div className="stat-value">{stats.failed}</div>
                        <div className="stat-label">Failed Verifications</div>
                        <div className="stat-change down">Linked test cases are failing</div>
                    </div>
                    <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #f59e0b, #d97706)' } as React.CSSProperties}>
                        <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>⚠️</div>
                        <div className="stat-value">{stats.partial + stats.unverified}</div>
                        <div className="stat-label">Pending Verifications</div>
                        <div className="stat-change warning">{stats.partial} partially, {stats.unverified} unverified</div>
                    </div>
                </div>

                {/* Pie Chart Card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>Quality Status Index</div>
                    {stats.total === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>No ticket metrics recorded yet.</div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <ResponsiveContainer width={130} height={130}>
                                <PieChart>
                                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                                        {chartData.map((entry, i) => (
                                            <Cell key={i} fill={VERIFICATION_COLORS[entry.name as keyof typeof VERIFICATION_COLORS] || '#64748b'} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {Object.entries(VERIFICATION_COLORS).map(([name, color]) => {
                                    const val = name === 'Verified' ? stats.verified : name === 'Failed' ? stats.failed : name === 'Partially Verified' ? stats.partial : stats.unverified;
                                    return (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                                                <span style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
                                            </div>
                                            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Section */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="form-input"
                        style={{ maxWidth: 280, flex: 1 }}
                        placeholder="🔍 Search tickets by ID, title..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        id="ticket-search-input"
                    />
                    
                    <select className="form-select" style={{ maxWidth: 160 }} value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
                        <option value="">All Platforms</option>
                        <option value="jira">🔷 Jira</option>
                        <option value="servicenow">❄️ ServiceNow</option>
                        <option value="github">🐙 GitHub</option>
                        <option value="azure">☁️ Azure DevOps</option>
                        <option value="manual">🔧 Manual</option>
                    </select>

                    <select className="form-select" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">All Statuses</option>
                        {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select className="form-select" style={{ maxWidth: 180 }} value={filterVerification} onChange={e => setFilterVerification(e.target.value)}>
                        <option value="">All Verifications</option>
                        <option value="Verified">Verified</option>
                        <option value="Failed">Failed</option>
                        <option value="Partially Verified">Partially Verified</option>
                        <option value="Unverified">Unverified</option>
                    </select>

                    <select className="form-select" style={{ maxWidth: 150 }} value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                        <option value="">All Teams</option>
                        {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    {selectedTicketIds.size > 0 && (
                        <button 
                            className="btn btn-accent btn-sm animate-pulse" 
                            style={{ marginLeft: 'auto' }}
                            onClick={handleLaunchVerificationRun}
                            id="batch-run-verification-btn"
                        >
                            ▶️ Run Verification for {selectedTicketIds.size} Selected Ticket(s)
                        </button>
                    )}
                </div>
            </div>

            {/* Main Traceability Matrix List */}
            <div className="card" style={{ padding: 0 }}>
                {filteredTickets.length === 0 ? (
                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                        <div className="empty-state-icon">🎫</div>
                        <div className="empty-state-title">No tickets linked</div>
                        <div className="empty-state-desc">Link requirement tickets manually or sync from connected platforms like Jira or ServiceNow.</div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={openNewTicket}>+ Link Ticket</button>
                            <button className="btn btn-outline" onClick={handleSyncTickets}>🔄 Trigger Sync</button>
                        </div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input 
                                            type="checkbox" 
                                            className="table-checkbox" 
                                            checked={selectedTicketIds.size === filteredTickets.length && filteredTickets.length > 0} 
                                            onChange={toggleAllTickets} 
                                        />
                                    </th>
                                    <th style={{ width: 140 }}>Ticket ID</th>
                                    <th>Title & Description</th>
                                    <th style={{ width: 110 }}>Priority</th>
                                    <th style={{ width: 110 }}>Platform Status</th>
                                    <th style={{ width: 160 }}>Verification Status</th>
                                    <th style={{ width: 160 }}>Test Cases</th>
                                    <th style={{ width: 120 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTickets.map(ticket => {
                                    const vStatus = getVerificationStatus(ticket);
                                    const linkedTCs = getLinkedTCsForTicket(ticket);
                                    const linkedCount = linkedTCs.length;
                                    
                                    return (
                                        <tr key={ticket.id} style={{ verticalAlign: 'top' }}>
                                            <td style={{ paddingTop: 16 }}>
                                                <input 
                                                    type="checkbox" 
                                                    className="table-checkbox" 
                                                    checked={selectedTicketIds.has(ticket.id)} 
                                                    onChange={() => toggleTicketSelection(ticket.id)} 
                                                />
                                            </td>
                                            <td style={{ paddingTop: 14 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: 16 }} title={ticket.platform}>{PLATFORM_ICONS[ticket.platform]}</span>
                                                    <span className="badge badge-muted" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>
                                                        {ticket.ticketId}
                                                    </span>
                                                </div>
                                                {ticket.lastSyncAt && (
                                                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                        Sync: {new Date(ticket.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 14 }}>{ticket.title}</div>
                                                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                                                    {ticket.description}
                                                </div>
                                                {ticket.assignee && (
                                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                                                        👤 Assignee: <strong>{state.users.find(u => u.id === ticket.assignee)?.name || ticket.assignee}</strong>
                                                    </div>
                                                )}
                                                {(ticket.teamIds || []).length > 0 && (
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                                                        {(ticket.teamIds || []).map(tid => {
                                                            const team = state.teams.find(t => t.id === tid);
                                                            return team ? <span key={tid} className="badge badge-accent" style={{ fontSize: 10 }}>{team.name}</span> : null;
                                                        })}
                                                    </div>
                                                )}
                                                {ticket.folderId && (
                                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                        📂 {state.folders.find(f => f.id === ticket.folderId)?.name || ticket.folderId}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ paddingTop: 14 }}>
                                                <span className={`badge badge-${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                                            </td>
                                            <td style={{ paddingTop: 14 }}>
                                                <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{ticket.status}</span>
                                            </td>
                                            <td style={{ paddingTop: 14 }}>
                                                <span 
                                                    style={{ 
                                                        background: `${VERIFICATION_COLORS[vStatus]}20`, 
                                                        border: `1px solid ${VERIFICATION_COLORS[vStatus]}40`, 
                                                        color: VERIFICATION_COLORS[vStatus],
                                                        padding: '4px 8px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        display: 'inline-block'
                                                    }}
                                                >
                                                    {vStatus}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <button 
                                                        className="btn btn-outline btn-sm" 
                                                        style={{ width: '100%', fontSize: 11, padding: '3px 8px' }}
                                                        onClick={() => setShowLinkModal(ticket.id)}
                                                    >
                                                        🔗 Manage ({linkedCount})
                                                    </button>
                                                    
                                                     {linkedCount > 0 && (
                                                         <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                                             {linkedTCs.map(tc => (
                                                                     <div key={tc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                                                                         <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-muted)' }} title={tc.title}>
                                                                             {tc.tcId}
                                                                         </span>
                                                                         <span className={`badge badge-${getStatusColor(tc.status)}`} style={{ fontSize: 8, padding: '1px 4px' }}>
                                                                             {tc.status}
                                                                         </span>
                                                                     </div>
                                                                 ))}
                                                         </div>
                                                     )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditTicket(ticket)} title="Edit">✏️</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTicket(ticket.id)} style={{ color: 'var(--color-danger)' }} title="Delete">🗑️</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => { setGenTicketId(ticket.id); setGenFolderId(''); }} title="Generate Test Cases">🧪</button>
                                                    {linkedCount > 0 && (
                                                        <button 
                                                            className="btn btn-ghost btn-sm" 
                                                            onClick={() => {
                                                                setSelectedTicketIds(new Set([ticket.id]));
                                                                setTimeout(() => handleLaunchVerificationRun(), 50);
                                                            }} 
                                                            title="Run Verification Tests"
                                                        >
                                                            ▶️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

                </div>
            </div>

            {/* Create/Edit Ticket Modal */}
            {showTicketModal && (
                <div className="modal-overlay" onClick={closeTicketModal} role="dialog" aria-modal="true" aria-label="Ticket">
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{editTicket ? 'Edit Linked Ticket' : 'Link External Ticket'}</div>
                                <div className="modal-subtitle">Define issue key metadata parameters mapping to workspace test files</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowTicketModal(false)}>✕</button>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Ticket ID / Issue Key *</label>
                                <input 
                                    className="form-input" 
                                    value={ticketForm.ticketId || ''} 
                                    onChange={e => setTicketForm({ ...ticketForm, ticketId: e.target.value })} 
                                    placeholder="e.g. JIRA-402, SNOW-109, GH-25" 
                                    id="ticket-id-field"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Platform Source</label>
                                <select 
                                    className="form-select" 
                                    value={ticketForm.platform} 
                                    onChange={e => setTicketForm({ ...ticketForm, platform: e.target.value as Ticket['platform'] })}
                                >
                                    <option value="manual">🔧 Manual Ticket</option>
                                    <option value="jira">🔷 Jira Issue</option>
                                    <option value="servicenow">❄️ ServiceNow Incident</option>
                                    <option value="github">🐙 GitHub Issue / PR</option>
                                    <option value="azure">☁️ Azure DevOps Work Item</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Ticket Title *</label>
                            <input 
                                className="form-input" 
                                value={ticketForm.title || ''} 
                                onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })} 
                                placeholder="Checkout checkout billing address validation failures..." 
                                id="ticket-title-field"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description / Acceptance Criteria</label>
                            <textarea 
                                className="form-textarea" 
                                rows={3}
                                value={ticketForm.description || ''} 
                                onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} 
                                placeholder="Describe features or errors tracked in this ticket..." 
                            />
                        </div>

                        <div className="form-row-3">
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select 
                                    className="form-select" 
                                    value={ticketForm.priority} 
                                    onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value as Ticket['priority'] })}
                                >
                                    {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Platform Status</label>
                                <select 
                                    className="form-select" 
                                    value={ticketForm.status} 
                                    onChange={e => setTicketForm({ ...ticketForm, status: e.target.value as Ticket['status'] })}
                                >
                                    {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assignee</label>
                                <select 
                                    className="form-select" 
                                    value={ticketForm.assignee || ''} 
                                    onChange={e => setTicketForm({ ...ticketForm, assignee: e.target.value })}
                                >
                                    <option value="">— Unassigned —</option>
                                    {state.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Folder / Release</label>
                                <select className="form-select" value={ticketForm.folderId || ''} onChange={e => setTicketForm({ ...ticketForm, folderId: e.target.value })}>
                                    <option value="">— No Folder —</option>
                                    {state.folders.filter(f => f.type === 'release' || f.type === 'project').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teams (multi-select)</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', minHeight: 32 }}>
                                    {(ticketForm.teamIds || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Select teams...</span>}
                                    {state.teams.map(team => {
                                        const selected = (ticketForm.teamIds || []).includes(team.id);
                                        return (
                                            <label key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: selected ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: selected ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent', fontSize: 12 }}>
                                                <input type="checkbox" checked={selected} onChange={() => {
                                                    const current = ticketForm.teamIds || [];
                                                    const next = selected ? current.filter(id => id !== team.id) : [...current, team.id];
                                                    setTicketForm({ ...ticketForm, teamIds: next });
                                                }} style={{ accentColor: 'var(--color-primary)' }} />
                                                {team.name}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowTicketModal(false)}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSaveTicket} 
                                disabled={!ticketForm.title?.trim() || !ticketForm.ticketId?.trim()}
                                id="save-ticket-btn"
                            >
                                💾 Save Ticket Mappings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Links Modal */}
            {showLinkModal && (() => {
                const ticket = state.tickets.find(t => t.id === showLinkModal);
                if (!ticket) return null;
                const ticketTeamIds = ticket.teamIds || [];
                const availableTCs = state.testCases.filter(tc => ticketTeamIds.length === 0 || ticketTeamIds.includes(getTcTeamId(tc) || ''));

                return (
                    <div className="modal-overlay" onClick={closeLinkModal} role="dialog" aria-modal="true" aria-label="Link Test Cases">
                        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <div className="modal-title">Link Test Cases to {ticket.ticketId}</div>
                                    <div className="modal-subtitle">{ticket.title}</div>
                                </div>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowLinkModal(null)}>✕</button>
                            </div>

                            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                                {availableTCs.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                        No test cases found for this ticket's team(s).
                                    </div>
                                ) : (
                                    availableTCs.map(tc => {
                                        const isLinked = ticket.linkedTestCases.includes(tc.id);
                                        return (
                                                <label 
                                                    key={tc.id} 
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: 10, 
                                                        padding: '8px 10px', 
                                                        borderRadius: 'var(--radius-sm)', 
                                                        cursor: 'pointer', 
                                                        background: isLinked ? 'rgba(59,130,246,0.08)' : 'transparent', 
                                                        transition: 'background 0.15s',
                                                        border: '1px solid transparent',
                                                        borderColor: isLinked ? 'rgba(59,130,246,0.2)' : 'transparent',
                                                    }}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        className="table-checkbox" 
                                                        checked={isLinked} 
                                                        onChange={() => handleLinkToggle(ticket.id, tc.id, isLinked)} 
                                                    />
                                                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{tc.tcId}</span>
                                                <span className={`badge badge-${getPriorityColor(tc.priority)}`} style={{ fontSize: 10 }}>{tc.priority}</span>
                                                <span className={`badge badge-${getStatusColor(tc.status)}`} style={{ fontSize: 10 }}>{tc.status}</span>
                                                <span style={{ fontSize: 13, flex: 1, color: 'var(--color-text-primary)' }}>{tc.title}</span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-primary" onClick={() => setShowLinkModal(null)}>Done</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Generate Test Cases from Ticket Dialog */}
            {genTicketId && (
                <div className="modal-overlay" onClick={() => { setGenTicketId(null); setGenFolderId(''); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <div className="modal-title">🧪 Generate Test Cases</div>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setGenTicketId(null); setGenFolderId(''); }}>✕</button>
                        </div>
                        <div style={{ padding: '16px 20px' }}>
                            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                                Select a team to generate 3 test cases (Happy Path, Negative, Edge Case) from ticket: <strong>{state.tickets.find(t => t.id === genTicketId)?.title}</strong>
                            </p>
                            <div className="form-group">
                                <label className="form-label">Target Team *</label>
                                <select className="form-select" value={genFolderId} onChange={e => {
                                    const folderId = e.target.value;
                                    setGenFolderId(folderId);
                                }}>
                                    <option value="">— Select Team —</option>
                                    {state.teams.filter(t => state.folders.some(f => f.teamId === t.id)).map(t => {
                                        const firstFolder = state.folders.find(f => f.teamId === t.id && (f.type === 'release' || f.type === 'project')) || state.folders.find(f => f.teamId === t.id);
                                        return <option key={t.id} value={firstFolder?.id || ''}>{t.name}</option>;
                                    })}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => { setGenTicketId(null); setGenFolderId(''); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={generateTCsFromTicket} disabled={!genFolderId}>🚀 Generate</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FolderTreeNode({ folder, depth, state, folderFilter, setFolderFilter, expandedFolders, setExpandedFolders, dispatch }: {
    folder: Folder; depth: number; state: AppState;
    folderFilter: string; setFolderFilter: (id: string) => void;
    expandedFolders: Set<string>; setExpandedFolders: (s: Set<string>) => void;
    dispatch: React.Dispatch<any>;
}) {
    const children = state.folders.filter(f => f.parentId === folder.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const tcCount = state.testCases.filter(tc => tc.folderId === folder.id).length;
    const linkedTicketIds = new Set(state.tickets.filter(t => t.linkedTestCases.some(tcId => state.testCases.find(tc => tc.id === tcId)?.folderId === folder.id)).map(t => t.id));
    const isSelected = folderFilter === folder.id;
    const canDelete = state.currentUser?.role === 'Admin' || state.currentUser?.role === 'Lead';
    return (
        <div style={{ marginLeft: depth * 12 }}>
            <div style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--color-primary-light)' : 'var(--color-text-primary)', marginBottom: 1 }}
            >
                <div onClick={() => { setFolderFilter(folder.id); if (hasChildren) { const n = new Set(expandedFolders); if (n.has(folder.id)) n.delete(folder.id); else n.add(folder.id); setExpandedFolders(n); } }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
                >
                    <span style={{ fontSize: 10, width: 12 }}>{hasChildren ? (isExpanded ? '▼' : '▶') : ''}</span>
                    <span>{folder.type === 'project' ? '🗂️' : folder.type === 'release' ? '🏷️' : '📁'}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-word', lineHeight: 1.3 }}>{folder.name}</span>
                    {linkedTicketIds.size > 0 && <span className="badge badge-primary" style={{ fontSize: 9 }}>{linkedTicketIds.size}</span>}
                    {tcCount > 0 && <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>({tcCount} TC)</span>}
                </div>
                    {canDelete && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '0 4px', color: 'var(--color-danger)', opacity: 0.6 }} onClick={e => { e.stopPropagation(); if (confirm(`Delete "${folder.name}" and ALL subfolders? Test cases will be unassigned (kept in Test Cases module).`)) dispatch({ type: 'DELETE_FOLDER', payload: folder.id }); }} title="Delete folder">🗑️</button>
                    )}
            </div>
            {isExpanded && children.map(child => (
                <FolderTreeNode key={child.id} folder={child} depth={depth + 1} state={state} folderFilter={folderFilter} setFolderFilter={setFolderFilter} expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders} dispatch={dispatch} />
            ))}
        </div>
    );
}
