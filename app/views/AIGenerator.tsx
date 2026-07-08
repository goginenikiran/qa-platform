'use client';

import React, { useState, useMemo } from 'react';
import { useApp, Requirement, TestCase, generateId, hasPermission } from '../store/AppContext';

type GeneratorTab = 'generate' | 'requirements';

interface GeneratedTC {
    title: string;
    priority: string;
    description: string;
    preconditions: string;
    steps: { action: string; expectedResult: string }[];
    tags: string[];
}

function generateLocalTCs(requirement: string, count: number): GeneratedTC[] {
    const req = requirement.toLowerCase();
    const isAuth = req.includes('login') || req.includes('auth') || req.includes('password');
    const isPayment = req.includes('payment') || req.includes('checkout') || req.includes('billing');
    const isSecurity = req.includes('encrypt') || req.includes('secure') || req.includes('permission');
    const isPerformance = req.includes('second') || req.includes('performance') || req.includes('within');

    const templates: GeneratedTC[] = [];

    if (isAuth) {
        templates.push(
            { title: 'Verify successful authentication with valid credentials', priority: 'Critical', description: 'Validate positive login scenario', preconditions: 'Test user account exists', tags: ['auth', 'smoke'], steps: [
                { action: 'Navigate to login page', expectedResult: 'Login page displayed' },
                { action: 'Enter valid credentials and submit', expectedResult: 'User is logged in and redirected to dashboard' },
            ]},
            { title: 'Verify error on invalid password', priority: 'High', description: 'Ensure error handling for bad credentials', preconditions: 'Test user account exists', tags: ['auth', 'negative'], steps: [
                { action: 'Enter valid username and wrong password', expectedResult: 'Error: "Invalid username or password"' },
            ]},
            { title: 'Verify account lockout after 3 failed attempts', priority: 'High', description: 'Ensure security lockout mechanism works', preconditions: 'Test user account exists', tags: ['auth', 'security'], steps: [
                { action: 'Enter wrong password 3 times consecutively', expectedResult: 'Account is locked, user notified' },
            ]},
        );
    }
    if (isPayment) {
        templates.push(
            { title: 'Verify successful payment flow', priority: 'Critical', description: 'Validate complete payment with valid card', preconditions: 'User has items in cart', tags: ['payment', 'smoke'], steps: [
                { action: 'Proceed to checkout with valid card details', expectedResult: 'Payment processed, confirmation shown' },
                { action: 'Verify confirmation email', expectedResult: 'Email received within 2 minutes' },
            ]},
            { title: 'Verify payment rejection for expired card', priority: 'High', description: 'Ensure expired cards are rejected', preconditions: 'User has items in cart', tags: ['payment', 'negative'], steps: [
                { action: 'Enter expired card details and submit', expectedResult: 'Error: "Card expired"' },
            ]},
        );
    }
    if (isSecurity) {
        templates.push(
            { title: 'Verify data encryption in transit', priority: 'Critical', description: 'Ensure HTTPS is used for all data', preconditions: 'Network inspection tool', tags: ['security'], steps: [
                { action: 'Perform sensitive actions and inspect network traffic', expectedResult: 'All requests use HTTPS, no plain-text sensitive data' },
            ]},
        );
    }
    if (isPerformance) {
        templates.push(
            { title: 'Verify response time meets SLA', priority: 'High', description: 'Validate performance within threshold', preconditions: 'Performance monitoring configured', tags: ['performance'], steps: [
                { action: 'Trigger the operation and measure time', expectedResult: 'Completes within defined SLA' },
            ]},
        );
    }

    if (templates.length === 0) {
        templates.push(
            { title: `Verify: ${requirement.slice(0, 60)}`, priority: 'Medium', description: `Happy path for ${requirement.slice(0, 80)}`, preconditions: 'Preconditions as defined', tags: ['functional'], steps: [
                { action: 'Execute the requirement steps', expectedResult: 'System behaves as expected' },
                { action: 'Verify no side effects', expectedResult: 'System state is consistent' },
            ]},
            { title: `Negative: ${requirement.slice(0, 50)}`, priority: 'High', description: 'Edge case for requirement', preconditions: 'System ready for negative test', tags: ['negative'], steps: [
                { action: 'Attempt to violate requirement condition', expectedResult: 'System prevents action with appropriate error' },
            ]},
        );
    }

    return templates.slice(0, count);
}

export default function AIGenerator() {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<GeneratorTab>('generate');

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            fontSize: 18, color: 'white',
                        }}>🤖</span>
                        AI Test Generator
                    </div>
                    <div className="page-subtitle">Generate comprehensive test cases from requirements using AI</div>
                </div>
                <span style={{
                    fontSize: 11, background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.3)', padding: '3px 10px',
                    borderRadius: 20, fontWeight: 600,
                }}>✨ Gemini / OpenRouter</span>
            </div>

            <div className="tabs" style={{ marginBottom: 20 }}>
                <button className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generate')}>🤖 Generate TCs</button>
                <button className={`tab ${activeTab === 'requirements' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requirements')}>📋 Requirements</button>
            </div>

            {activeTab === 'generate' && <GenerateTab state={state} dispatch={dispatch} />}
            {activeTab === 'requirements' && <RequirementsTab state={state} dispatch={dispatch} />}
        </div>
    );
}

/* ===== TAB 1: Generate ===== */
function GenerateTab({ state, dispatch }: { state: ReturnType<typeof useApp>['state']; dispatch: ReturnType<typeof useApp>['dispatch'] }) {
    const [requirementText, setRequirementText] = useState('');
    const [count, setCount] = useState(5);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedTCs, setGeneratedTCs] = useState<GeneratedTC[]>([]);
    const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());
    const [aiSource, setAiSource] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const [connectionType, setConnectionType] = useState<'manual' | 'servicenow' | 'jira' | 'github' | 'azure'>('manual');

    // Unified fetch modal state
    const [showFetchModal, setShowFetchModal] = useState(false);
    const [fetchKey, setFetchKey] = useState('');
    const [fetchLoading, setFetchLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!requirementText.trim()) return;
        setIsGenerating(true);
        setGeneratedTCs([]);
        setSelectedGenerated(new Set());
        setAiError(null);
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requirement: requirementText, count }),
            });
            const data = await res.json();
            if (data.fallback) {
                const tcs = generateLocalTCs(requirementText, count);
                setGeneratedTCs(tcs);
                setSelectedGenerated(new Set(tcs.map((_u: unknown, i: number) => i)));
                setAiSource('templates');
            } else if (data.error) {
                setAiError(data.error);
                const tcs = generateLocalTCs(requirementText, count);
                setGeneratedTCs(tcs);
                setSelectedGenerated(new Set(tcs.map((_u: unknown, i: number) => i)));
                setAiSource('templates');
            } else {
                setAiSource(data.provider || 'ai');
                const tcs = (data.testCases || []).map((tc: any) => ({
                    title: tc.title || 'Untitled',
                    priority: (tc.priority && ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority)) ? tc.priority : 'Medium',
                    description: tc.description || '',
                    preconditions: tc.preconditions || '',
                    steps: Array.isArray(tc.steps) ? tc.steps.map((s: any) => ({ action: s.action || '', expectedResult: s.expectedResult || '' })) : [],
                    tags: Array.isArray(tc.tags) ? tc.tags : [],
                }));
                setGeneratedTCs(tcs);
                setSelectedGenerated(new Set(tcs.map((_u: unknown, i: number) => i)));
            }
        } catch {
            const tcs = generateLocalTCs(requirementText, count);
            setGeneratedTCs(tcs);
            setSelectedGenerated(new Set(tcs.map((_u: unknown, i: number) => i)));
            setAiSource('templates');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImport = () => {
        if (!selectedFolder || selectedGenerated.size === 0) return;
        const folder = state.folders.find(f => f.id === selectedFolder);
        const team = folder?.teamId ? state.teams.find(t => t.id === folder.teamId) : null;
        const prefix = team ? team.name : 'TC';
        const teamFolderIds = folder?.teamId ? state.folders.filter(f => f.teamId === folder.teamId).map(f => f.id) : [selectedFolder];
        let count = state.testCases.filter(tc =>
            teamFolderIds.includes(tc.folderId) ||
            tc.tcId.toUpperCase().startsWith(prefix.toUpperCase() + '-TC')
        ).length;
        const newTCs: TestCase[] = [...selectedGenerated].map((idx) => {
            count += 1;
            const gen = generatedTCs[idx];
            return {
                id: generateId(),
                tcId: `${prefix}-TC${String(count).padStart(2, '0')}`,
                title: gen.title,
                description: gen.description,
                priority: gen.priority as TestCase['priority'],
                status: 'Not Run',
                module: folder?.name || '',
                folderId: selectedFolder,
                preconditions: gen.preconditions,
                steps: gen.steps.map((s, si) => ({ id: generateId(), stepNumber: si + 1, action: s.action, expectedResult: s.expectedResult })),
                tags: gen.tags,
                createdBy: 'AI Generator',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                estimatedTime: gen.steps.length * 2,
                automationStatus: 'Manual',
            };
        });
        dispatch({ type: 'IMPORT_TEST_CASES', payload: newTCs });
        setGeneratedTCs([]);
        setSelectedGenerated(new Set());
    };

    const fetchFromIntegration = async () => {
        if (!fetchKey.trim()) return;
        setFetchLoading(true);
        setFetchError(null);
        try {
            // Try to look up locally synced tickets first
            const matchedTicket = state.tickets.find((t: any) =>
                t.ticketId.toUpperCase() === fetchKey.trim().toUpperCase() &&
                t.platform === connectionType
            );

            if (matchedTicket) {
                const text = `[${matchedTicket.ticketId}] ${matchedTicket.title}\n\n${matchedTicket.description || ''}\n\nPriority: ${matchedTicket.priority || 'N/A'}\nStatus: ${matchedTicket.status || 'N/A'}\nPlatform: ${matchedTicket.platform}`;
                setRequirementText(text);
                setShowFetchModal(false);
                setFetchKey('');
                setFetchLoading(false);
                return;
            }

            if (connectionType === 'servicenow') {
                const snowIntegration = state.integrations.find((i: any) => i.type === 'servicenow');
                const config = snowIntegration?.config || { instanceUrl: 'https://dev12345.service-now.com', username: 'admin', syncTable: 'incident' };

                const res = await fetch('/api/servicenow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instanceUrl: config.instanceUrl,
                        username: config.username,
                        password: config.password,
                        authMethod: config.authMethod || 'basic',
                        clientId: config.clientId || '',
                        clientSecret: config.clientSecret || '',
                        incidentNumber: fetchKey.trim(),
                    }),
                });

                const bodyText = await res.text();
                let data: any;
                try {
                    data = JSON.parse(bodyText);
                } catch {
                    setFetchError('Server returned unexpected response. Please try again.');
                    setFetchLoading(false);
                    return;
                }

                if (!res.ok) {
                    setFetchError(data.error || `Failed with status ${res.status}`);
                    setFetchLoading(false);
                    return;
                }

                const inc = data.incident;
                if (inc) {
                    const text = `[${inc.number}] ${inc.title}\n\n${inc.description || ''}\n\nPriority: ${inc.priority || 'N/A'}\nState: ${inc.state || 'N/A'}\nAssigned To: ${inc.assigned_to || 'Unassigned'}`;
                    setRequirementText(text);
                    setShowFetchModal(false);
                    setFetchKey('');
                } else {
                    setFetchError('Incident not found.');
                }
            } else {
                // Mock integration fetch for Jira, GitHub, Azure
                await new Promise(r => setTimeout(r, 1000));
                
                let title = '';
                let desc = '';
                let priority = 'High';
                let status = 'Open';
                
                const cleanKey = fetchKey.trim().toUpperCase();
                
                if (connectionType === 'jira') {
                    if (cleanKey.includes('881')) {
                        title = 'Stripe tokenization mismatch error';
                        desc = 'Verify checkout throws random failures in Stripe element token mapping.';
                        priority = 'Critical';
                        status = 'In Progress';
                    } else if (cleanKey.includes('882')) {
                        title = 'User profile avatar upload fails';
                        desc = 'Avatar upload returns 500 for images > 2MB.';
                        priority = 'High';
                        status = 'Open';
                    } else {
                        title = `Jira Issue: Feature implementation for ${cleanKey}`;
                        desc = `Functional requirements and acceptance criteria for issue ${cleanKey}.\n- User must be authenticated.\n- System must validate inputs.\n- API must return a 201 created status code.`;
                    }
                } else if (connectionType === 'github') {
                    if (cleanKey.includes('216')) {
                        title = 'Fix pagination offset on search results';
                        desc = 'Search results page 2+ returns duplicate entries.';
                        priority = 'Medium';
                        status = 'Open';
                    } else if (cleanKey.includes('217')) {
                        title = 'Add rate limiting to public API';
                        desc = 'Public endpoints need rate limiting to prevent abuse.';
                        priority = 'High';
                        status = 'Open';
                    } else {
                        title = `GitHub Issue: Resolve bug in module ${cleanKey}`;
                        desc = `User reported that the module ${cleanKey} crashes under load.\nExpected behavior: System should handle errors gracefully and show friendly message.`;
                    }
                } else if (connectionType === 'azure') {
                    if (cleanKey.includes('101')) {
                        title = 'Deployment pipeline stalled on staging';
                        desc = 'Azure DevOps pipeline fails at integration test stage.';
                        priority = 'Critical';
                        status = 'Open';
                    } else if (cleanKey.includes('102')) {
                        title = 'Update terraform scripts for new region';
                        desc = 'Add support for APAC region infrastructure.';
                        priority = 'Medium';
                        status = 'In Progress';
                    } else {
                        title = `Azure DevOps Work Item: ${cleanKey}`;
                        desc = `Implementation details for backlog item ${cleanKey}.\nTasks:\n- Write unit tests.\n- Update configuration.\n- Perform staging deployment.`;
                    }
                }
                
                const text = `[${cleanKey}] ${title}\n\n${desc}\n\nPriority: ${priority}\nStatus: ${status}\nPlatform: ${connectionType.toUpperCase()}`;
                setRequirementText(text);
                setShowFetchModal(false);
                setFetchKey('');
            }
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to fetch from integration');
        } finally {
            setFetchLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>📝 Paste Requirements</div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Connection Type / Source</label>
                        <select className="form-select" value={connectionType} onChange={(e) => {
                            setConnectionType(e.target.value as any);
                        }} id="ai-generator-connection-type">
                            <option value="manual">Manual Input</option>
                            <option value="servicenow">ServiceNow</option>
                            <option value="jira">Jira Software</option>
                            <option value="github">GitHub</option>
                            <option value="azure">Azure DevOps</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <textarea
                            className="form-textarea"
                            value={requirementText}
                            onChange={(e) => setRequirementText(e.target.value)}
                            placeholder="Paste your requirements or acceptance criteria here...&#10;&#10;e.g. User must be able to login with valid credentials.&#10;System should lock account after 3 failed attempts."
                            rows={8}
                        />
                    </div>
                    <div className="form-row" style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Count</label>
                            <select className="form-select" value={count} onChange={(e) => setCount(+e.target.value)}>
                                {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n} test cases</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                            <label className="form-label">Target Team</label>
                            <select className="form-select" value={selectedTeam} onChange={(e) => {
                                const teamId = e.target.value;
                                setSelectedTeam(teamId);
                                if (!teamId) { setSelectedFolder(''); return; }
                                let folder = state.folders.find(f => f.teamId === teamId && (f.type === 'release' || f.type === 'project')) || state.folders.find(f => f.teamId === teamId);
                                if (!folder) {
                                    const team = state.teams.find(t => t.id === teamId);
                                    if (team) {
                                        const newFolder = {
                                            id: generateId(), name: team.name, description: `Auto-created for ${team.name}`,
                                            parentId: undefined, type: 'release' as const, color: '#3b82f6',
                                            teamId, startDate: '', endDate: '', createdAt: new Date().toISOString(),
                                        };
                                        dispatch({ type: 'ADD_FOLDER', payload: newFolder });
                                        folder = newFolder;
                                    }
                                }
                                setSelectedFolder(folder?.id || '');
                            }}>
                                <option value="">— Select team —</option>
                                {state.teams.map(t => {
                                    const hasFolder = state.folders.some(f => f.teamId === t.id);
                                    return <option key={t.id} value={t.id}>{t.name}{!hasFolder ? ' (will create folder)' : ''}</option>;
                                })}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button className="btn btn-accent btn-lg" style={{ flex: 1 }}
                            onClick={handleGenerate} disabled={!requirementText.trim() || isGenerating}>
                            {isGenerating ? <>⟳ Generating...</> : '🧠 Generate Test Cases'}
                        </button>
                        {connectionType !== 'manual' && (
                            <button className="btn btn-outline" style={{ width: 140 }}
                                onClick={() => { setShowFetchModal(true); setFetchError(null); }}
                                id={`fetch-btn-${connectionType}`}>
                                {connectionType === 'servicenow' ? '❄️ ServiceNow' :
                                 connectionType === 'jira' ? '🔷 Jira' :
                                 connectionType === 'github' ? '🐙 GitHub' :
                                 connectionType === 'azure' ? '☁️ Azure DevOps' : '🔌 Fetch Data'}
                            </button>
                        )}
                    </div>
                    {aiSource && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                            Powered by {aiSource === 'gemini' ? '✨ Gemini AI' : aiSource === 'openrouter' ? '🔗 OpenRouter (free)' : aiSource === 'templates' ? '📋 Smart Templates' : aiSource}
                        </div>
                    )}
                    {aiError && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#f59e0b' }}>
                            ⚠️ {aiError} — showing template results instead.
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Import into Folder</label>
                    <select className="form-select" value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
                        <option value="">— Select target folder —</option>
                        {state.folders.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results Panel */}
            <div>
                {isGenerating && (
                    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: 48, marginBottom: 16, display: 'inline-block' }} className="animate-spin">⟳</div>
                        <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>AI is analyzing requirements...</div>
                    </div>
                )}
                {!isGenerating && generatedTCs.length > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                📋 {generatedTCs.length} test cases generated
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleImport}
                                disabled={selectedGenerated.size === 0 || !selectedFolder}>
                                📥 Import ({selectedGenerated.size})
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {generatedTCs.map((tc, idx) => {
                                const isSelected = selectedGenerated.has(idx);
                                return (
                                    <div key={idx} style={{
                                        background: isSelected ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${isSelected ? 'rgba(139,92,246,0.3)' : 'var(--color-border)'}`,
                                        borderRadius: 'var(--radius-lg)', padding: 14, cursor: 'pointer',
                                    }} onClick={() => {
                                        const next = new Set(selectedGenerated);
                                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                                        setSelectedGenerated(next);
                                    }}>
                                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                                            <input type="checkbox" className="table-checkbox" checked={isSelected} readOnly style={{ marginTop: 2 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    <span className={`badge badge-${tc.priority === 'Critical' ? 'danger' : tc.priority === 'High' ? 'warning' : tc.priority === 'Medium' ? 'info' : 'muted'}`}>{tc.priority}</span>
                                                    <span className="badge badge-accent" style={{ fontSize: 10 }}>AI Generated</span>
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>{tc.title}</div>
                                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{tc.description}</div>
                                            </div>
                                        </div>
                                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Steps ({tc.steps.length})</div>
                                            {tc.steps.slice(0, 3).map((s, si) => (
                                                <div key={si} style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 3, paddingLeft: 8, borderLeft: '2px solid rgba(139,92,246,0.3)' }}>
                                                    <span style={{ fontWeight: 600 }}>#{si + 1}</span> {s.action}
                                                </div>
                                            ))}
                                            {tc.steps.length > 3 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{tc.steps.length - 3} more steps</div>}
                                            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                                                {tc.tags.map((tag) => (
                                                    <span key={tag} className="badge badge-muted" style={{ fontSize: 10 }}>{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {!isGenerating && generatedTCs.length === 0 && (
                    <div className="card">
                        <div className="empty-state">
                            <div className="empty-state-icon">🤖</div>
                            <div className="empty-state-title">AI Test Generator Ready</div>
                            <div className="empty-state-desc">
                                Enter your requirement on the left and click Generate to create intelligent test cases automatically
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Unified Fetch Modal */}
            {showFetchModal && (
                <div className="modal-overlay" onClick={() => setShowFetchModal(false)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">
                                    {connectionType === 'servicenow' && '❄️ Fetch from ServiceNow'}
                                    {connectionType === 'jira' && '🔷 Fetch from Jira'}
                                    {connectionType === 'github' && '🐙 Fetch from GitHub'}
                                    {connectionType === 'azure' && '☁️ Fetch from Azure DevOps'}
                                </div>
                                <div className="modal-subtitle">
                                    Enter key details to import as requirement text
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowFetchModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label" id="fetch-key-label">
                                {connectionType === 'servicenow' && 'Incident Number *'}
                                {connectionType === 'jira' && 'Jira Issue Key *'}
                                {connectionType === 'github' && 'GitHub Issue Number *'}
                                {connectionType === 'azure' && 'Work Item ID *'}
                            </label>
                            <input
                                className="form-input"
                                value={fetchKey}
                                onChange={(e) => setFetchKey(e.target.value)}
                                placeholder={
                                    connectionType === 'servicenow' ? 'e.g. INC0012345' :
                                    connectionType === 'jira' ? 'e.g. JIRA-881' :
                                    connectionType === 'github' ? 'e.g. 216' :
                                    connectionType === 'azure' ? 'e.g. 101' : 'Enter identifier'
                                }
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter' && fetchKey.trim()) fetchFromIntegration(); }}
                                id="fetch-key-input"
                            />
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                The ticket details will populate the requirement text on the left
                            </div>
                        </div>

                        {fetchError && (
                            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
                                {fetchError}
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowFetchModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={fetchFromIntegration}
                                disabled={!fetchKey.trim() || fetchLoading}
                                id="fetch-submit-btn">
                                {fetchLoading ? <>⟳ Fetching...</> : '🔌 Fetch Details'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ===== TAB 2: Requirements ===== */
function RequirementsTab({ state, dispatch }: { state: ReturnType<typeof useApp>['state']; dispatch: ReturnType<typeof useApp>['dispatch'] }) {
    const [search, setSearch] = useState('');
    const [filterSource, setFilterSource] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editReq, setEditReq] = useState<Requirement | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formAcceptance, setFormAcceptance] = useState('');
    const [formSource, setFormSource] = useState('manual');
    const [formFolderId, setFormFolderId] = useState('');
    const [formAssignee, setFormAssignee] = useState('');

    const filtered = useMemo(() => {
        return state.requirements.filter(r => {
            const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
            const matchSource = filterSource === 'all' || r.source === filterSource;
            return matchSearch && matchSource;
        });
    }, [state.requirements, search, filterSource]);

    const openNew = () => {
        setEditReq(null);
        setFormTitle('');
        setFormDesc('');
        setFormAcceptance('');
        setFormSource('manual');
        setFormFolderId('');
        setFormAssignee('');
        setShowForm(true);
    };

    const openEdit = (req: Requirement) => {
        setEditReq(req);
        setFormTitle(req.title);
        setFormDesc(req.description);
        setFormAcceptance(req.acceptanceCriteria || '');
        setFormSource(req.source);
        setFormFolderId(req.folderId || '');
        setFormAssignee(req.assignee || '');
        setShowForm(true);
    };

    const handleSave = () => {
        if (!formTitle.trim()) return;
        if (editReq) {
            dispatch({
                type: 'UPDATE_REQUIREMENT',
                payload: { ...editReq, title: formTitle, description: formDesc, acceptanceCriteria: formAcceptance, source: formSource, folderId: formFolderId, assignee: formAssignee },
            });
        } else {
            dispatch({
                type: 'ADD_REQUIREMENT',
                payload: {
                    id: generateId(), title: formTitle, description: formDesc, acceptanceCriteria: formAcceptance,
                    source: formSource, folderId: formFolderId, assignee: formAssignee,
                    linkedTestCases: [], createdAt: new Date().toISOString(),
                },
            });
        }
        setShowForm(false);
        setEditReq(null);
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this requirement?')) {
            dispatch({ type: 'DELETE_REQUIREMENT', payload: id });
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <input className="form-input" placeholder="Search requirements..." value={search}
                    onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
                <select className="form-select" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ width: 160 }}>
                    <option value="all">All Sources</option>
                    <option value="manual">Manual</option>
                    <option value="jira">Jira</option>
                    <option value="servicenow">ServiceNow</option>
                    <option value="imported">Imported</option>
                </select>
                <button className="btn btn-primary" onClick={openNew}>+ New Requirement</button>
            </div>

            <div className="card">
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-title">No requirements</div>
                        <div className="empty-state-desc">Create your first requirement or import from an integration</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filtered.map(req => (
                            <div key={req.id} style={{
                                padding: '12px 16px', border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span className="badge badge-muted">{req.source}</span>
                                        {req.assignee && <span className="badge badge-accent">{req.assignee}</span>}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{req.title}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{req.description.slice(0, 120)}{req.description.length > 120 ? '...' : ''}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                        {req.linkedTestCases.length} linked TCs · Created {new Date(req.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(req)}>✏️</button>
                                    {hasPermission(state.currentUser, 'delete') && (
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(req.id)}>🗑️</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Requirement Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => { setShowForm(false); setEditReq(null); }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{editReq ? 'Edit Requirement' : 'New Requirement'}</div>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowForm(false); setEditReq(null); }}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Requirement title" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Describe the requirement..." rows={3} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Acceptance Criteria</label>
                            <textarea className="form-textarea" value={formAcceptance} onChange={(e) => setFormAcceptance(e.target.value)} placeholder="Define acceptance criteria..." rows={3} />
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Source</label>
                                <select className="form-select" value={formSource} onChange={(e) => setFormSource(e.target.value)}>
                                    <option value="manual">Manual</option>
                                    <option value="jira">Jira</option>
                                    <option value="servicenow">ServiceNow</option>
                                    <option value="imported">Imported</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Folder</label>
                                <select className="form-select" value={formFolderId} onChange={(e) => setFormFolderId(e.target.value)}>
                                    <option value="">— None —</option>
                                    {state.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assignee</label>
                            <select className="form-select" value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)}>
                                <option value="">— Unassigned —</option>
                                {state.users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditReq(null); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!formTitle.trim()}>💾 {editReq ? 'Update' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
