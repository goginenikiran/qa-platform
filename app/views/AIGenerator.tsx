'use client';

import React, { useState } from 'react';
import { useApp, TestCase, Requirement, generateId } from '../store/AppContext';

const GENERATION_PROMPTS = [
    'User must be able to login with valid credentials',
    'System should reject login with incorrect password after 3 attempts',
    'Payment processing must complete within 5 seconds',
    'User data must be encrypted in transit and at rest',
];

interface GeneratedTC {
    title: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    preconditions: string;
    steps: { action: string; expectedResult: string }[];
    tags: string[];
}

function generateTestCases(requirement: string, count: number): GeneratedTC[] {
    // Simulate AI generation with intelligent patterns based on keywords
    const req = requirement.toLowerCase();

    const isAuth = req.includes('login') || req.includes('auth') || req.includes('password') || req.includes('sso');
    const isPayment = req.includes('payment') || req.includes('checkout') || req.includes('billing') || req.includes('transaction');
    const isSecurity = req.includes('encrypt') || req.includes('secure') || req.includes('permission') || req.includes('role') || req.includes('access');
    const isPerformance = req.includes('second') || req.includes('millisecond') || req.includes('performance') || req.includes('within') || req.includes('fast');
    const isUI = req.includes('display') || req.includes('show') || req.includes('view') || req.includes('button') || req.includes('page');

    const baseTemplates: GeneratedTC[] = [];

    if (isAuth) {
        baseTemplates.push(
            {
                title: 'Verify successful authentication with valid credentials', priority: 'Critical', description: 'Validate positive login scenario with correct credentials', preconditions: 'Test user account exists in the system', tags: ['auth', 'smoke', 'critical-path'],
                steps: [
                    { action: 'Navigate to the login page', expectedResult: 'Login page is displayed with username and password fields' },
                    { action: 'Enter valid username in the username field', expectedResult: 'Username is accepted and displayed in the field' },
                    { action: 'Enter valid password in the password field', expectedResult: 'Password is masked and accepted' },
                    { action: 'Click the Login / Sign In button', expectedResult: 'User is authenticated and redirected to the dashboard/home page' },
                    { action: 'Verify the user session is active', expectedResult: 'User name/profile is visible in the header, session token is set' },
                ]
            },
            {
                title: 'Verify authentication failure with invalid password', priority: 'High', description: 'Ensure appropriate error handling on invalid credentials', preconditions: 'Test user account exists in the system', tags: ['auth', 'negative', 'security'],
                steps: [
                    { action: 'Navigate to the login page', expectedResult: 'Login page is displayed' },
                    { action: 'Enter valid username and an incorrect password', expectedResult: 'Fields accept the input' },
                    { action: 'Click the Login button', expectedResult: 'Error message is displayed: "Invalid username or password"' },
                    { action: 'Verify user remains on the login page', expectedResult: 'Login page is still shown; no redirect occurs' },
                ]
            },
            {
                title: 'Verify account lockout after multiple failed login attempts', priority: 'High', description: 'Test security lockout mechanism', preconditions: 'User account exists; lockout policy is configured (e.g., 3–5 attempts)', tags: ['auth', 'security', 'lockout'],
                steps: [
                    { action: 'Attempt to log in with wrong password 3 consecutive times', expectedResult: 'Each attempt shows error: "Invalid credentials"' },
                    { action: 'Attempt a 4th login with wrong password', expectedResult: 'Account is locked; message shown: "Account locked. Try again after X minutes"' },
                    { action: 'Try to login with correct credentials while account is locked', expectedResult: 'Login still blocked; lockout message shown' },
                ]
            },
            {
                title: 'Verify "Remember Me" functionality persists session', priority: 'Medium', description: 'Validate session persistence when Remember Me is selected', preconditions: 'Remember Me feature is enabled', tags: ['auth', 'session'],
                steps: [
                    { action: 'Login with valid credentials and check "Remember Me"', expectedResult: 'Login succeeds' },
                    { action: 'Close the browser and reopen the application', expectedResult: 'User remains logged in without re-entering credentials' },
                ]
            },
        );
    }

    if (isPayment) {
        baseTemplates.push(
            {
                title: 'Verify successful payment with valid credit card', priority: 'Critical', description: 'Test complete payment flow with a valid card', preconditions: 'User is logged in with items in cart, test payment gateway configured', tags: ['payment', 'smoke', 'critical-path'],
                steps: [
                    { action: 'Navigate to the cart and click "Checkout"', expectedResult: 'Checkout page loads with order summary' },
                    { action: 'Enter valid credit card details (number, expiry, CVV)', expectedResult: 'Card details are accepted and validated' },
                    { action: 'Click "Pay Now"', expectedResult: 'Payment is processed; confirmation page shown with order number' },
                    { action: 'Verify confirmation email received', expectedResult: 'Email with order details is received within 2 minutes' },
                ]
            },
            {
                title: 'Verify payment failure with declined card returns proper error', priority: 'High', description: 'Validate error handling for declined cards', preconditions: 'User is on checkout page with test declined card number', tags: ['payment', 'negative'],
                steps: [
                    { action: 'Enter a test declined card number and submit', expectedResult: 'Payment gateway processes then declines' },
                    { action: 'Verify error message is shown', expectedResult: '"Your card was declined. Please try a different payment method." is displayed' },
                    { action: 'Verify the order is NOT created', expectedResult: 'No order record created in the system' },
                ]
            },
        );
    }

    if (isSecurity) {
        baseTemplates.push(
            {
                title: 'Verify sensitive data is encrypted in transit (HTTPS)', priority: 'Critical', description: 'Ensure all data is transmitted over HTTPS', preconditions: 'Access to network traffic inspection tool (e.g., browser dev tools)', tags: ['security', 'encryption'],
                steps: [
                    { action: 'Open browser developer tools → Network tab', expectedResult: 'Network tab is open' },
                    { action: 'Perform actions that transmit sensitive data (login, checkout)', expectedResult: 'All requests use HTTPS protocol (padlock visible in browser)' },
                    { action: 'Verify no sensitive data in plain text in request/response headers', expectedResult: 'Passwords, tokens, card numbers are not visible in plain text' },
                ]
            },
            {
                title: 'Verify role-based access control enforces permissions', priority: 'High', description: 'Test that users cannot access resources beyond their role', preconditions: 'Two user accounts: one admin, one regular user', tags: ['security', 'authorization', 'rbac'],
                steps: [
                    { action: 'Log in as a regular user', expectedResult: 'Regular user dashboard shown' },
                    { action: 'Attempt to access an admin-only URL directly', expectedResult: '403 Forbidden or redirect to unauthorized page' },
                    { action: 'Log in as an admin user and access the same URL', expectedResult: 'Admin page loads successfully' },
                ]
            },
        );
    }

    if (isPerformance) {
        baseTemplates.push(
            {
                title: 'Verify page/feature response time meets SLA requirements', priority: 'High', description: 'Validate performance within defined time thresholds', preconditions: 'Performance monitoring tool configured; test environment mirrors production', tags: ['performance', 'sla'],
                steps: [
                    { action: 'Start performance timer / open browser dev tools', expectedResult: 'Timer/network recording active' },
                    { action: 'Trigger the operation defined in the requirement', expectedResult: 'Operation initiates' },
                    { action: 'Measure time until operation completes', expectedResult: 'Operation completes within the defined SLA (e.g., 5 seconds)' },
                    { action: 'Repeat the test under concurrent load (10 users)', expectedResult: 'SLA still met under concurrent load conditions' },
                ]
            },
        );
    }

    if (isUI) {
        baseTemplates.push(
            {
                title: 'Verify UI elements display correctly on supported browsers', priority: 'Medium', description: 'Cross-browser compatibility check for key UI elements', preconditions: 'Access to Chrome, Firefox, Safari, and Edge browsers', tags: ['ui', 'cross-browser', 'compatibility'],
                steps: [
                    { action: 'Open the feature in Chrome latest version', expectedResult: 'All UI elements render correctly; no layout issues' },
                    { action: 'Open the feature in Firefox latest version', expectedResult: 'UI is consistent with Chrome rendering' },
                    { action: 'Open the feature in Safari latest version', expectedResult: 'UI is consistent; no Safari-specific rendering issues' },
                    { action: 'Test responsive behavior on mobile viewport (375px)', expectedResult: 'Layout adapts correctly for mobile screens' },
                ]
            },
        );
    }

    // Generic fallback
    if (baseTemplates.length === 0) {
        baseTemplates.push(
            {
                title: `Verify: ${requirement.slice(0, 60)}`, priority: 'Medium', description: `Test the happy path for: ${requirement}`, preconditions: 'Preconditions as defined in the requirement', tags: ['functional', 'regression'],
                steps: [
                    { action: 'Set up the required preconditions as defined', expectedResult: 'Preconditions are met' },
                    { action: 'Execute the steps defined in the requirement', expectedResult: 'Action executes without errors' },
                    { action: 'Verify the outcome matches the acceptance criteria', expectedResult: `System behaves as required: ${requirement.slice(0, 80)}` },
                    { action: 'Verify no negative side effects occurred', expectedResult: 'No unintended changes to system state' },
                ]
            },
            {
                title: `Verify negative scenario: ${requirement.slice(0, 50)}`, priority: 'High', description: `Test edge/negative case for: ${requirement}`, preconditions: 'System is in a state to test the negative scenario', tags: ['negative', 'regression'],
                steps: [
                    { action: 'Attempt to violate the requirement condition', expectedResult: 'System prevents the action with appropriate error' },
                    { action: 'Verify system remains in a stable state', expectedResult: 'No data corruption or unexpected errors' },
                ]
            },
        );
    }

    return baseTemplates.slice(0, count);
}

export default function AIGenerator() {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<'generate' | 'requirements'>('generate');
    const [requirementText, setRequirementText] = useState('');
    const [source, setSource] = useState('Manual Input');
    const [count, setCount] = useState(3);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedTCs, setGeneratedTCs] = useState<GeneratedTC[]>([]);
    const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());
    const [savedReq, setSavedReq] = useState('');
    const [reqForm, setReqForm] = useState({ title: '', description: '', acceptanceCriteria: '', source: 'Jira' });
    const [aiSource, setAiSource] = useState<'gemini' | 'fallback' | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!requirementText.trim()) return;
        setIsGenerating(true);
        setGeneratedTCs([]);
        setSelectedGenerated(new Set());
        setAiError(null);
        setAiSource(null);

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requirement: requirementText, count }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Unknown server error');
            }

            if (data.fallback) {
                // No API key — use built-in template engine
                setAiSource('fallback');
                const tcs = generateTestCases(requirementText, count);
                setGeneratedTCs(tcs);
                setSelectedGenerated(new Set(tcs.map((_, i) => i)));
            } else {
                // Real Gemini response
                setAiSource('gemini');
                const tcs: GeneratedTC[] = data.testCases.map((tc: { title?: string; priority?: string; description?: string; preconditions?: string; steps?: { action?: string; expectedResult?: string }[]; tags?: string[] }) => ({
                    title: tc.title || 'Untitled',
                    priority: (tc.priority && ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority)) ? (tc.priority as GeneratedTC['priority']) : 'Medium',
                    description: tc.description || '',
                    preconditions: tc.preconditions || '',
                    steps: Array.isArray(tc.steps) ? tc.steps.map((s: { action?: string; expectedResult?: string }) => ({ action: s.action || '', expectedResult: s.expectedResult || '' })) : [],
                    tags: Array.isArray(tc.tags) ? tc.tags : [],
                }));
                setGeneratedTCs(tcs);
                setSelectedGenerated(new Set(tcs.map((_, i) => i)));
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to generate test cases.';
            setAiError(errMsg);
            // Always fall back gracefully
            const tcs = generateTestCases(requirementText, count);
            setGeneratedTCs(tcs);
            setAiSource('fallback');
            setSelectedGenerated(new Set(tcs.map((_, i) => i)));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImport = () => {
        if (!selectedFolder || selectedGenerated.size === 0) return;
        const folder = state.folders.find(f => f.id === selectedFolder);
        const base = state.testCases.length;
        const newTCs: TestCase[] = [...selectedGenerated].map((idx, i) => {
            const gen = generatedTCs[idx];
            const tcNum = base + i + 1;
            return {
                id: generateId(),
                tcId: `TC-${String(tcNum).padStart(3, '0')}`,
                title: gen.title,
                description: gen.description,
                priority: gen.priority,
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
                requirementId: savedReq || undefined,
            };
        });
        dispatch({ type: 'IMPORT_TEST_CASES', payload: newTCs });
        setGeneratedTCs([]);
        setSavedReq('');
        alert(`✅ ${newTCs.length} test cases imported successfully!`);
    };

    const handleSaveRequirement = () => {
        if (!reqForm.title.trim()) return;
        const req: Requirement = {
            id: generateId(),
            title: reqForm.title,
            description: reqForm.description,
            acceptanceCriteria: reqForm.acceptanceCriteria,
            source: reqForm.source,
            linkedTestCases: [],
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_REQUIREMENT', payload: req });
        setReqForm({ title: '', description: '', acceptanceCriteria: '', source: 'Jira' });
        alert('✅ Requirement saved!');
    };

    const toggleGenerated = (idx: number) => {
        const next = new Set(selectedGenerated);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        setSelectedGenerated(next);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">AI Test Generator</div>
                    <div className="page-subtitle">Generate comprehensive test cases from requirements using AI</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {aiSource === 'gemini' && (
                        <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                            ✨ Powered by Gemini AI
                        </span>
                    )}
                    {aiSource === 'fallback' && (
                        <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                            📋 Smart Templates (add GEMINI_API_KEY for real AI)
                        </span>
                    )}
                    <span className="ai-badge">🤖 AI Powered</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>🤖 Generate Test Cases</button>
                <button className={`tab ${activeTab === 'requirements' ? 'active' : ''}`} onClick={() => setActiveTab('requirements')}>📋 Requirements ({state.requirements.length})</button>
            </div>

            {activeTab === 'generate' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Input Panel */}
                    <div>
                        <div className="ai-panel" style={{ marginBottom: 16 }}>
                            <div className="ai-panel-header">
                                <span style={{ fontSize: 24 }}>🤖</span>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>AI Test Case Generator</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Paste requirements or acceptance criteria to auto-generate test cases</div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Requirement / Acceptance Criteria *</label>
                                <textarea
                                    className="form-textarea"
                                    value={requirementText}
                                    onChange={e => setRequirementText(e.target.value)}
                                    placeholder="e.g. User must be able to login with valid credentials. System should lock account after 3 failed attempts. Payment processing must complete within 5 seconds..."
                                    rows={6}
                                    id="requirement-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Source</label>
                                    <select className="form-select" value={source} onChange={e => setSource(e.target.value)}>
                                        {['Manual Input', 'Jira', 'ServiceNow', 'Confluence', 'Word/PDF', 'Acceptance Criteria'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Generate # Cases</label>
                                    <select className="form-select" value={count} onChange={e => setCount(+e.target.value)}>
                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} test cases</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Quick Prompts */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div className="card-title" style={{ marginBottom: 12, fontSize: 13 }}>💡 Quick Prompts</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {GENERATION_PROMPTS.map(p => (
                                    <button key={p} className="btn btn-outline btn-sm" style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                                        onClick={() => setRequirementText(p)}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Import into Folder</label>
                            <select className="form-select" value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}>
                                <option value="">— Select target folder —</option>
                                {state.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>

                        <button className="btn btn-accent btn-lg" style={{ width: '100%' }} onClick={handleGenerate}
                            disabled={!requirementText.trim() || isGenerating} id="generate-btn">
                            {isGenerating ? (
                                <><span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span> Analyzing & Generating...</>
                            ) : '🤖 Generate Test Cases with AI'}
                        </button>

                        {aiError && (
                            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#f59e0b' }}>
                                ⚠️ Gemini API error — showing smart template results instead.<br />
                                <span style={{ opacity: 0.7 }}>{aiError}</span>
                            </div>
                        )}
                    </div>

                    {/* Results Panel */}
                    <div>
                        {isGenerating && (
                            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>AI is analyzing your requirement...</div>
                                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>Identifying test scenarios, edge cases, and creating structured test steps</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {['Parsing requirements...', 'Identifying test scenarios...', 'Generating step-by-step cases...', 'Assigning priorities...'].map((step, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'rgba(139,92,246,0.08)', borderRadius: 'var(--radius-md)' }}>
                                            <span className="animate-pulse">✨</span>
                                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isGenerating && generatedTCs.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                        {aiSource === 'gemini' ? '✨ Gemini AI' : '📋 Templates'} — {generatedTCs.length} test cases generated
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={selectedGenerated.size === 0 || !selectedFolder} id="import-generated-btn">
                                        📥 Import Selected ({selectedGenerated.size})
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {generatedTCs.map((tc, idx) => {
                                        const isSelected = selectedGenerated.has(idx);
                                        return (
                                            <div key={idx} style={{
                                                background: isSelected ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${isSelected ? 'rgba(139,92,246,0.3)' : 'var(--color-border)'}`,
                                                borderRadius: 'var(--radius-lg)', padding: '16px', cursor: 'pointer', transition: 'all 0.15s',
                                            }} onClick={() => toggleGenerated(idx)}>
                                                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                                    <input type="checkbox" className="table-checkbox" checked={isSelected} onChange={() => { }} style={{ marginTop: 2 }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                            <span className={`badge badge-${tc.priority === 'Critical' ? 'danger' : tc.priority === 'High' ? 'warning' : tc.priority === 'Medium' ? 'info' : 'muted'}`}>{tc.priority}</span>
                                                            <span className="badge badge-accent" style={{ fontSize: 10 }}>AI Generated</span>
                                                        </div>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>{tc.title}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{tc.description}</div>
                                                    </div>
                                                </div>
                                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Steps ({tc.steps.length})</div>
                                                    {tc.steps.slice(0, 3).map((s, si) => (
                                                        <div key={si} style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid rgba(139,92,246,0.3)' }}>
                                                            <span style={{ fontWeight: 600 }}>#{si + 1}</span> {s.action}
                                                        </div>
                                                    ))}
                                                    {tc.steps.length > 3 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{tc.steps.length - 3} more steps</div>}
                                                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                                                        {tc.tags.map(tag => <span key={tag} className="badge badge-muted" style={{ fontSize: 10 }}>{tag}</span>)}
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
                                    <div className="empty-state-desc">Enter your requirement or acceptance criteria on the left and click Generate to create intelligent test cases automatically</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'requirements' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>Add Requirement</div>
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" value={reqForm.title} onChange={e => setReqForm({ ...reqForm, title: e.target.value })} placeholder="REQ-001: User Authentication" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Source</label>
                            <select className="form-select" value={reqForm.source} onChange={e => setReqForm({ ...reqForm, source: e.target.value })}>
                                {['Jira', 'ServiceNow', 'Confluence', 'Word', 'Email', 'Business Analyst', 'Customer'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} rows={3} placeholder="Describe the requirement..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Acceptance Criteria</label>
                            <textarea className="form-textarea" value={reqForm.acceptanceCriteria} onChange={e => setReqForm({ ...reqForm, acceptanceCriteria: e.target.value })} rows={4}
                                placeholder="Given... When... Then...&#10;GIVEN the user has valid credentials&#10;WHEN they click Login&#10;THEN they are redirected to the dashboard" />
                        </div>
                        <button className="btn btn-primary" onClick={handleSaveRequirement} style={{ width: '100%' }}>💾 Save Requirement</button>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Requirements ({state.requirements.length})</div>
                        </div>
                        {state.requirements.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <div className="empty-state-title">No requirements yet</div>
                                <div className="empty-state-desc">Add requirements from Jira, ServiceNow, or manual input to link with test cases</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {state.requirements.map(req => (
                                    <div key={req.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{req.title}</div>
                                            <span className="badge badge-muted">{req.source}</span>
                                        </div>
                                        {req.acceptanceCriteria && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{"\""}{req.acceptanceCriteria.slice(0, 100)}...{"\""}</div>}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => { setActiveTab('generate'); setRequirementText(req.acceptanceCriteria || req.description); }}>
                                                🤖 Generate TCs
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
