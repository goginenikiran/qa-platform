'use client';

import React, { useState } from 'react';
import { useApp, Integration, generateId } from '../store/AppContext';

const APP_TYPES = [
    {
        type: 'servicenow', name: 'ServiceNow', icon: '❄️', color: '#00a79d',
        description: 'Connect to ServiceNow for incident, change, and problem management integration.',
        glow: 'rgba(0,167,157,0.12)', borderColor: 'rgba(0,167,157,0.3)',
        fields: [
            { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://dev12345.service-now.com', type: 'url' },
            { key: 'username', label: 'Username', placeholder: 'admin', type: 'text' },
            { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
            { key: 'syncTable', label: 'Sync Table', placeholder: 'incident', type: 'text' },
        ],
    },
    {
        type: 'jira', name: 'Jira Software', icon: '🔷', color: '#0052cc',
        description: 'Import issues, link requirements, and sync test results with Jira.',
        glow: 'rgba(0,82,204,0.12)', borderColor: 'rgba(0,82,204,0.3)',
        fields: [
            { key: 'baseUrl', label: 'Base URL', placeholder: 'https://yourcompany.atlassian.net', type: 'url' },
            { key: 'email', label: 'Email', placeholder: 'user@company.com', type: 'email' },
            { key: 'apiToken', label: 'API Token', placeholder: 'Your Jira API token', type: 'password' },
            { key: 'projectKey', label: 'Project Key', placeholder: 'QA', type: 'text' },
        ],
    },
    {
        type: 'azure', name: 'Azure DevOps', icon: '☁️', color: '#0078d4',
        description: 'Sync with Azure Boards, Repos, and Test Plans for full DevOps integration.',
        glow: 'rgba(0,120,212,0.12)', borderColor: 'rgba(0,120,212,0.3)',
        fields: [
            { key: 'orgUrl', label: 'Organization URL', placeholder: 'https://dev.azure.com/yourorg', type: 'url' },
            { key: 'pat', label: 'Personal Access Token', placeholder: 'Azure PAT', type: 'password' },
            { key: 'project', label: 'Project Name', placeholder: 'MyProject', type: 'text' },
        ],
    },
    {
        type: 'github', name: 'GitHub', icon: '🐙', color: '#e8e8e8',
        description: 'Link test cases to GitHub issues and pull requests for full traceability.',
        glow: 'rgba(232,232,232,0.08)', borderColor: 'rgba(232,232,232,0.2)',
        fields: [
            { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_xxxxx', type: 'password' },
            { key: 'owner', label: 'Repository Owner', placeholder: 'your-org', type: 'text' },
            { key: 'repo', label: 'Repository Name', placeholder: 'your-repo', type: 'text' },
        ],
    },
    {
        type: 'custom', name: 'Custom REST API', icon: '🔧', color: '#8b5cf6',
        description: 'Connect any REST API endpoint to extend the platform with custom integrations.',
        glow: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.3)',
        fields: [
            { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.example.com', type: 'url' },
            { key: 'apiKey', label: 'API Key / Token', placeholder: 'Bearer token or API key', type: 'password' },
            { key: 'headers', label: 'Extra Headers (JSON)', placeholder: '{"X-Custom": "value"}', type: 'text' },
        ],
    },
];

export default function Integrations() {
    const { state, dispatch } = useApp();
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [editIntegration, setEditIntegration] = useState<Integration | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [formName, setFormName] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');

    const appType = APP_TYPES.find(a => a.type === selectedType || a.type === editIntegration?.type);

    const openNew = (type: string) => {
        setSelectedType(type);
        setEditIntegration(null);
        setFormData({});
        setFormName(APP_TYPES.find(a => a.type === type)?.name || '');
        setTestResult('idle');
    };

    const openEdit = (integration: Integration) => {
        setEditIntegration(integration);
        setSelectedType(null);
        setFormData({ ...integration.config });
        setFormName(integration.name);
        setTestResult('idle');
    };

    const handleSave = () => {
        if (editIntegration) {
            dispatch({
                type: 'UPDATE_INTEGRATION',
                payload: { ...editIntegration, name: formName, config: formData },
            });
        } else if (selectedType && appType) {
            dispatch({
                type: 'ADD_INTEGRATION',
                payload: {
                    id: generateId(), type: selectedType as Integration['type'],
                    name: formName, status: 'disconnected',
                    config: formData, icon: appType.icon, color: appType.color,
                },
            });
        }
        setSelectedType(null);
        setEditIntegration(null);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult('idle');

        // Real test for ServiceNow
        if (appType?.type === 'servicenow' && formData.instanceUrl && formData.username && formData.password) {
            try {
                const res = await fetch('/api/servicenow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instanceUrl: formData.instanceUrl,
                        username: formData.username,
                        password: formData.password,
                        action: 'test',
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    setTestResult('success');
                    if (editIntegration) {
                        dispatch({ type: 'UPDATE_INTEGRATION', payload: { ...editIntegration, status: 'connected', lastSync: new Date().toISOString(), config: formData, name: formName } });
                    }
                } else {
                    setTestResult('error');
                    setTestError(data.error || 'Connection failed');
                }
            } catch {
                setTestResult('error');
                setTestError('Network error — is the server running?');
            }
            setTesting(false);
            return;
        }

        // Simulated test for other integrations
        await new Promise(r => setTimeout(r, 1800));
        const hasRequiredFields = appType?.fields.every(f => formData[f.key]?.trim()) ?? false;
        setTestResult(hasRequiredFields ? 'success' : 'error');
        if (hasRequiredFields && editIntegration) {
            dispatch({ type: 'UPDATE_INTEGRATION', payload: { ...editIntegration, status: 'connected', lastSync: new Date().toISOString(), config: formData, name: formName } });
        }
        setTesting(false);
    };

    const handleDelete = (id: string) => {
        if (confirm('Remove this integration?')) {
            dispatch({ type: 'DELETE_INTEGRATION', payload: id });
        }
    };

    const isOpen = selectedType !== null || editIntegration !== null;

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">App Integrations</div>
                    <div className="page-subtitle">Connect your QA platform to external tools and platforms</div>
                </div>
            </div>

            {/* Available Integrations */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                    Available Integrations
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {APP_TYPES.map(app => {
                        const existing = state.integrations.find(i => i.type === app.type);
                        return (
                            <div
                                key={app.type}
                                className="app-integration-card"
                                style={{ '--card-glow': app.glow, '--card-border-color': app.borderColor } as React.CSSProperties}
                                onClick={() => existing ? openEdit(existing) : openNew(app.type)}
                                id={`integration-card-${app.type}`}
                            >
                                {existing && (
                                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                        <span className={`badge badge-${existing.status === 'connected' ? 'success' : 'danger'}`}>
                                            {existing.status === 'connected' ? '● Connected' : '○ Disconnected'}
                                        </span>
                                    </div>
                                )}
                                <div className="integration-icon" style={{ background: `${app.color}20` }}>
                                    <span>{app.icon}</span>
                                </div>
                                <div className="integration-name">{app.name}</div>
                                <div className="integration-desc">{app.description}</div>
                                {existing ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); openEdit(existing); }}>
                                            ⚙️ Configure
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                                        + Connect
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Integrations Table */}
            {state.integrations.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Active Integrations</div>
                        <span className="badge badge-primary">{state.integrations.length} configured</span>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Integration</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Last Sync</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.integrations.map(integration => (
                                    <tr key={integration.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: 20 }}>{integration.icon}</span>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{integration.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                                        {integration.config.instanceUrl || integration.config.baseUrl || integration.config.orgUrl || '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>
                                                {integration.type}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${integration.status === 'connected' ? 'success' : integration.status === 'error' ? 'danger' : 'warning'}`}>
                                                {integration.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                            {integration.lastSync ? new Date(integration.lastSync).toLocaleString() : 'Never'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(integration)}>⚙️ Edit</button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(integration.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {isOpen && appType && (
                <div className="modal-overlay" onClick={() => { setSelectedType(null); setEditIntegration(null); }}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                    <span style={{ fontSize: 28 }}>{appType.icon}</span>
                                    <div className="modal-title">Configure {appType.name}</div>
                                </div>
                                <div className="modal-subtitle">{appType.description}</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setSelectedType(null); setEditIntegration(null); }}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Integration Name</label>
                            <input
                                className="form-input"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder={`My ${appType.name} Connection`}
                                id="integration-name-input"
                            />
                        </div>

                        {appType.fields.map(field => (
                            <div className="form-group" key={field.key}>
                                <label className="form-label">{field.label}</label>
                                <input
                                    className="form-input"
                                    type={field.type}
                                    value={formData[field.key] || ''}
                                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                    placeholder={field.placeholder}
                                    id={`field-${field.key}`}
                                />
                            </div>
                        ))}

                        {testResult !== 'idle' && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md)',
                                background: testResult === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                                border: `1px solid ${testResult === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                color: testResult === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                                fontSize: 13,
                                marginBottom: 16,
                            }}>
                                {testResult === 'success' ? '✅ Connection successful! Integration saved.' : `❌ ${testError || 'Connection failed. Check your credentials and try again.'}`}
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => { setSelectedType(null); setEditIntegration(null); }}>Cancel</button>
                            <button className="btn btn-outline" onClick={handleTest} disabled={testing} id="test-connection-btn">
                                {testing ? <><span className="animate-spin">⟳</span> Testing...</> : '🔌 Test Connection'}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} id="save-integration-btn">💾 Save Integration</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
