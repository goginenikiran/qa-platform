'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { useApp, calculateRunStats } from '../store/AppContext';

const STATUS_COLORS: Record<string, string> = {
    Pass: '#10b981', Fail: '#ef4444', Blocked: '#f59e0b', Skipped: '#6366f1', 'Not Run': '#475569',
};
const SEVERITY_COLORS: Record<string, string> = {
    Critical: 'danger', High: 'warning', Medium: 'info', Low: 'muted',
};

type ReportTab = 'overview' | 'runs' | 'defects' | 'coverage' | 'schedule' | 'utilization';
type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'on-completion';
type ReportFormat = 'pdf' | 'csv' | 'json' | 'html';

interface ScheduledReport {
    id: string;
    name: string;
    frequency: ScheduleFrequency;
    emails: string[];
    format: ReportFormat;
    includeCharts: boolean;
    includeDefects: boolean;
    includeRunDetails: boolean;
    qualityGateThreshold: number;
    enabled: boolean;
    lastSent?: string;
    nextSend?: string;
    createdAt: string;
}

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
    daily: '🕐 Daily',
    weekly: '📅 Weekly',
    monthly: '📆 Monthly',
    'on-completion': '✅ On Run Completion',
};

export default function Reporting() {
    const { state } = useApp();
    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    const [selectedRunId, setSelectedRunId] = useState<string | null>(
        state.executionRuns.length > 0 ? state.executionRuns[0].id : null
    );

    // Scheduled reports state (persisted to localStorage)
    const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(() => {
        try {
            const saved = localStorage.getItem('qa-scheduled-reports');
            if (saved) return JSON.parse(saved);
        } catch { }
        return [
            {
                id: 'sr1',
                name: 'Weekly Quality Summary',
                frequency: 'weekly',
                emails: ['qa-team@company.com', 'manager@company.com'],
                format: 'pdf',
                includeCharts: true,
                includeDefects: true,
                includeRunDetails: false,
                qualityGateThreshold: 80,
                enabled: true,
                lastSent: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
                nextSend: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
            },
            {
                id: 'sr2',
                name: 'Daily Defect Alert',
                frequency: 'daily',
                emails: ['dev-team@company.com'],
                format: 'html',
                includeCharts: false,
                includeDefects: true,
                includeRunDetails: false,
                qualityGateThreshold: 90,
                enabled: false,
                createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
            },
        ];
    });

    // Persist scheduled reports
    useEffect(() => {
        try { localStorage.setItem('qa-scheduled-reports', JSON.stringify(scheduledReports)); } catch { }
    }, [scheduledReports]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editSchedule, setEditSchedule] = useState<ScheduledReport | null>(null);
    const [scheduleForm, setScheduleForm] = useState<Partial<ScheduledReport>>({
        name: '',
        frequency: 'weekly',
        emails: [],
        format: 'pdf',
        includeCharts: true,
        includeDefects: true,
        includeRunDetails: true,
        qualityGateThreshold: 80,
        enabled: true,
    });
    const [emailInput, setEmailInput] = useState('');
    const [sendTestEmailStatus, setSendTestEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    // Release & Team filters
    const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const releaseFolders = useMemo(() => state.folders.filter(f => f.type === 'release'), [state.folders]);
    const teams = state.teams;

    const filteredFolderIds = useMemo(() => {
        // Enforce RBAC base bounds
        let validFolders = state.folders.filter(f => state.currentUser?.role === 'Admin' || !f.teamId || state.currentUser?.teamIds.includes(f.teamId));

        // Start with all valid folders or folders within the selected release
        if (selectedReleaseId) {
            const releaseIds = new Set<string>([selectedReleaseId]);
            const collect = (parentId: string) => {
                state.folders.forEach(f => {
                    if (f.parentId === parentId) {
                        releaseIds.add(f.id);
                        collect(f.id);
                    }
                });
            };
            collect(selectedReleaseId);
            validFolders = validFolders.filter(f => releaseIds.has(f.id));
        }

        // Apply team filter
        if (selectedTeamId) {
            validFolders = validFolders.filter(f => f.teamId === selectedTeamId);
        }

        return new Set(validFolders.map(f => f.id));
    }, [selectedReleaseId, selectedTeamId, state.folders, state.currentUser]);

    const filteredTestCases = useMemo(() => {
        return state.testCases.filter(tc => filteredFolderIds.has(tc.folderId));
    }, [state.testCases, filteredFolderIds]);

    const filteredExecutionRuns = useMemo(() => {
        const tcIdsInRelease = new Set(filteredTestCases.map(tc => tc.id));
        return state.executionRuns.filter(run =>
            run.testCases.some(tcId => tcIdsInRelease.has(tcId))
        );
    }, [state.executionRuns, filteredTestCases]);

    const { testCases, executionRuns, folders, tickets } = state;

    // Always use filtered versions so RBAC is enforced even when no explicit UI filters are selected
    const displayTestCases = filteredTestCases;
    const displayExecutionRuns = filteredExecutionRuns;
    const selectedRun = displayExecutionRuns.find(r => r.id === selectedRunId);

    // ===== COMPUTED STATS (using display arrays for release filter support) =====
    const overallStats = useMemo(() => {
        const total = displayTestCases.length;
        const pass = displayTestCases.filter(t => t.status === 'Pass').length;
        const fail = displayTestCases.filter(t => t.status === 'Fail').length;
        const blocked = displayTestCases.filter(t => t.status === 'Blocked').length;
        const notRun = displayTestCases.filter(t => t.status === 'Not Run').length;
        const skipped = displayTestCases.filter(t => t.status === 'Skipped').length;
        const automated = displayTestCases.filter(t => t.automationStatus === 'Automated').length;
        const inProgress = displayTestCases.filter(t => t.automationStatus === 'In Progress').length;
        const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
        const defectRate = total > 0 ? Math.round((fail / total) * 100) : 0;
        const automationRate = total > 0 ? Math.round((automated / total) * 100) : 0;
        return { total, pass, fail, blocked, notRun, skipped, automated, inProgress, passRate, defectRate, automationRate };
    }, [displayTestCases]);

    // Bug stats from all runs
    const bugStats = useMemo(() => {
        const bugs: { bugId: string; severity: string; runName: string; tcId: string; title: string; url?: string }[] = [];
        displayExecutionRuns.forEach(run => {
            Object.entries(run.results).forEach(([tcId, res]) => {
                if (res.bug) {
                    bugs.push({
                        bugId: res.bug.bugId,
                        severity: res.bug.severity || 'Medium',
                        runName: run.name,
                        tcId,
                        title: res.bug.title || '',
                        url: res.bug.url,
                    });
                }
            });
        });
        const bySeverity: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        bugs.forEach(b => { bySeverity[b.severity] = (bySeverity[b.severity] || 0) + 1; });
        return { total: bugs.length, bySeverity, bugs };
    }, [displayExecutionRuns]);

    // Quality gate — pass/fail threshold
    const qualityGate = useMemo(() => {
        const threshold = 80;
        const passed = overallStats.passRate >= threshold;
        return { threshold, passed, passRate: overallStats.passRate };
    }, [overallStats]);

    // SLA metrics — runs completed on time (pass rate >= 75%)
    const slaMetrics = useMemo(() => {
        const completedRuns = displayExecutionRuns.filter(r => r.status === 'Completed');
        const slaPass = completedRuns.filter(r => {
            const st = calculateRunStats(r);
            return st.passRate >= 75;
        });
        const slaRate = completedRuns.length > 0 ? Math.round((slaPass.length / completedRuns.length) * 100) : 0;
        return { total: completedRuns.length, met: slaPass.length, missed: completedRuns.length - slaPass.length, rate: slaRate };
    }, [displayExecutionRuns]);

    // Ticket traceability coverage
    const traceabilityCoverage = useMemo(() => {
        const totalTickets = tickets?.length || 0;
        const linkedTickets = (tickets || []).filter(t => t.linkedTestCases && t.linkedTestCases.length > 0).length;
        const rate = totalTickets > 0 ? Math.round((linkedTickets / totalTickets) * 100) : 0;
        return { total: totalTickets, linked: linkedTickets, rate };
    }, [tickets]);

    // Pie & chart data
    const pieData = [
        { name: 'Pass', value: overallStats.pass },
        { name: 'Fail', value: overallStats.fail },
        { name: 'Blocked', value: overallStats.blocked },
        { name: 'Not Run', value: overallStats.notRun },
        { name: 'Skipped', value: overallStats.skipped },
    ].filter(d => d.value > 0);

    const folderStats = folders.map(folder => {
        const fTCs = displayTestCases.filter(t => t.folderId === folder.id);
        const pass = fTCs.filter(t => t.status === 'Pass').length;
        const fail = fTCs.filter(t => t.status === 'Fail').length;
        const blocked = fTCs.filter(t => t.status === 'Blocked').length;
        const total = fTCs.length;
        const passRate = total > 0 ? Math.round(pass / total * 100) : 0;
        return {
            name: folder.name.length > 15 ? folder.name.slice(0, 13) + '…' : folder.name,
            total, pass, fail, blocked, passRate,
            color: folder.color,
        };
    }).filter(f => f.total > 0);

    const priorityStats = ['Critical', 'High', 'Medium', 'Low'].map(p => ({
        name: p,
        total: displayTestCases.filter(t => t.priority === p).length,
        pass: displayTestCases.filter(t => t.priority === p && t.status === 'Pass').length,
        fail: displayTestCases.filter(t => t.priority === p && t.status === 'Fail').length,
        notRun: displayTestCases.filter(t => t.priority === p && t.status === 'Not Run').length,
    }));

    const runTrendData = [...displayExecutionRuns]
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
        .map(run => {
            const st = calculateRunStats(run);
            const bugCount = Object.values(run.results).filter(r => r.bug).length;
            return {
                name: run.name.length > 14 ? run.name.slice(0, 12) + '…' : run.name,
                passRate: st.passRate,
                pass: st.pass,
                fail: st.fail,
                bugs: bugCount,
            };
        });

    const radarData = folders.slice(0, 6).map(folder => {
        const fTCs = displayTestCases.filter(t => t.folderId === folder.id);
        const pass = fTCs.filter(t => t.status === 'Pass').length;
        const total = fTCs.length;
        return {
            subject: folder.name.length > 12 ? folder.name.slice(0, 10) + '…' : folder.name,
            coverage: total > 0 ? Math.round(pass / total * 100) : 0,
            fullMark: 100,
        };
    });

    const selectedRunStats = selectedRun ? calculateRunStats(selectedRun) : null;

    // ===== EXPORT FUNCTIONS =====
    const exportCSV = useCallback(() => {
        const rows = [
            ['TC ID', 'Title', 'Module', 'Priority', 'Status', 'Automation', 'Tags'],
            ...displayTestCases.map(tc => [
                tc.tcId, `"${tc.title}"`, tc.module, tc.priority, tc.status,
                tc.automationStatus, `"${tc.tags.join(', ')}"`,
            ]),
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `qa-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }, [displayTestCases]);

    const exportJSON = useCallback(() => {
        const payload = {
            generatedAt: new Date().toISOString(),
            summary: overallStats,
            bugs: bugStats.bugs,
            runs: displayExecutionRuns.map(r => ({ ...r, stats: calculateRunStats(r) })),
            testCases: displayTestCases,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `qa-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); URL.revokeObjectURL(url);
    }, [overallStats, bugStats, displayExecutionRuns, displayTestCases]);

    const exportPDF = () => window.print();

    // ===== SCHEDULE HANDLERS =====
    const openNewSchedule = () => {
        setEditSchedule(null);
        setScheduleForm({
            name: '', frequency: 'weekly', emails: [], format: 'pdf',
            includeCharts: true, includeDefects: true, includeRunDetails: true,
            qualityGateThreshold: 80, enabled: true,
        });
        setEmailInput('');
        setShowScheduleModal(true);
    };

    const openEditSchedule = (sr: ScheduledReport) => {
        setEditSchedule(sr);
        setScheduleForm({ ...sr });
        setEmailInput('');
        setShowScheduleModal(true);
    };

    const addEmail = () => {
        const email = emailInput.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
        const current = (scheduleForm.emails || []);
        if (!current.includes(email)) {
            setScheduleForm({ ...scheduleForm, emails: [...current, email] });
        }
        setEmailInput('');
    };

    const removeEmail = (email: string) => {
        setScheduleForm({ ...scheduleForm, emails: (scheduleForm.emails || []).filter(e => e !== email) });
    };

    const saveSchedule = () => {
        if (!scheduleForm.name?.trim() || !scheduleForm.emails?.length) return;
        const now = new Date().toISOString();
        if (editSchedule) {
            setScheduledReports(prev => prev.map(sr =>
                sr.id === editSchedule.id ? { ...sr, ...scheduleForm } as ScheduledReport : sr
            ));
        } else {
            const newSR: ScheduledReport = {
                ...scheduleForm,
                id: `sr-${Date.now()}`,
                createdAt: now,
                nextSend: now,
            } as ScheduledReport;
            setScheduledReports(prev => [...prev, newSR]);
        }
        setShowScheduleModal(false);
    };

    const toggleSchedule = (id: string) => {
        setScheduledReports(prev => prev.map(sr => sr.id === id ? { ...sr, enabled: !sr.enabled } : sr));
    };

    const deleteSchedule = (id: string) => {
        setScheduledReports(prev => prev.filter(sr => sr.id !== id));
    };

    const sendTestEmail = async () => {
        setSendTestEmailStatus('sending');
        try {
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: scheduleForm.emails?.[0] || 'test@example.com',
                    subject: `[QA Copilot] Test Report: ${scheduleForm.name || 'Scheduled Report'}`,
                    body: `This is a test email from QA Copilot.\n\nReport: ${scheduleForm.name || 'Untitled'}\nFrequency: ${scheduleForm.frequency || 'weekly'}\nFormat: ${scheduleForm.format || 'pdf'}\n\nIf you received this, your email configuration is working correctly.`,
                    format: scheduleForm.format || 'html',
                }),
            });
            if (res.ok) {
                setSendTestEmailStatus('sent');
            } else {
                setSendTestEmailStatus('error');
            }
        } catch {
            setSendTestEmailStatus('error');
        }
        setTimeout(() => setSendTestEmailStatus('idle'), 3000);
    };

const tabs: { id: ReportTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'runs',     label: 'Run Reports',    icon: '▶️' },
    { id: 'defects',  label: 'Defect Analytics', icon: '🐛' },
    { id: 'coverage', label: 'Coverage Matrix',  icon: '🗺️' },
    { id: 'utilization', label: 'Team Utilization', icon: '👥' },
    { id: 'schedule', label: `Scheduled Reports`, icon: '📧' },
];

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">📊 Reports & Analytics</div>
                    <div className="page-subtitle">Enterprise quality intelligence — metrics, trends, defect analysis, and automated report delivery</div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-outline" onClick={exportCSV} id="export-csv-btn">
                        📥 Export CSV
                    </button>
                    <button className="btn btn-outline" onClick={exportJSON} id="export-json-btn">
                        📦 Export JSON
                    </button>
                    <button className="btn btn-outline" onClick={exportPDF} id="export-pdf-btn">
                        📄 Print / PDF
                    </button>
                    <button className="btn btn-primary" onClick={() => { setActiveTab('schedule'); openNewSchedule(); }} id="schedule-report-btn">
                        📧 Schedule Report
                    </button>
                </div>
            </div>

            {/* Quality Gate Banner */}
            <div style={{
                padding: '12px 20px',
                marginBottom: 16,
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: qualityGate.passed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${qualityGate.passed ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
                <span style={{ fontSize: 28 }}>{qualityGate.passed ? '🟢' : '🔴'}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: qualityGate.passed ? '#10b981' : '#ef4444' }}>
                        Quality Gate: {qualityGate.passed ? 'PASSED' : 'FAILED'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Current pass rate {qualityGate.passRate}% — threshold is {qualityGate.threshold}%. {qualityGate.passed ? 'Release criteria met.' : 'Release blocked until threshold is met.'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>{slaMetrics.rate}%</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>SLA Met</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>{traceabilityCoverage.rate}%</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Traceability</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>{overallStats.automationRate}%</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Automated</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>🏷️ Filters:</span>
                
                {/* Release Filter */}
                <select className="form-select form-select-sm" style={{ maxWidth: 220, fontSize: 13 }} value={selectedReleaseId} onChange={e => setSelectedReleaseId(e.target.value)}>
                    <option value="">— All Releases —</option>
                    {releaseFolders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>

                {/* Team Filter */}
                <select className="form-select form-select-sm" style={{ maxWidth: 220, fontSize: 13 }} value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                    <option value="">— All Teams —</option>
                    {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>

                {(selectedReleaseId || selectedTeamId) && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                        Showing {displayTestCases.length} test cases across {displayExecutionRuns.length} runs
                    </span>
                )}
                {(selectedReleaseId || selectedTeamId) && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setSelectedReleaseId(''); setSelectedTeamId(''); }}>
                        ✕ Clear Filters
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 20 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        id={`report-tab-${tab.id}`}
                    >
                        {tab.icon} {tab.label}
                        {tab.id === 'schedule' && scheduledReports.filter(s => s.enabled).length > 0 && (
                            <span style={{ background: 'var(--color-primary)', borderRadius: '50%', padding: '1px 5px', fontSize: 9, marginLeft: 4, color: 'white' }}>
                                {scheduledReports.filter(s => s.enabled).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ===== OVERVIEW TAB ===== */}
            {activeTab === 'overview' && (
                <div>
                    {/* KPI Cards */}
                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', marginBottom: 20 }}>
                        {[
                            { label: 'Pass Rate', value: `${overallStats.passRate}%`, icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
                            { label: 'Defect Rate', value: `${overallStats.defectRate}%`, icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                            { label: 'Total Test Cases', value: overallStats.total, icon: '📋', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                            { label: 'Execution Runs', value: executionRuns.length, icon: '▶️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
                            { label: 'Automation %', value: `${overallStats.automationRate}%`, icon: '⚡', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
                            { label: 'Bugs Linked', value: bugStats.total, icon: '🐛', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                            { label: 'SLA Met', value: `${slaMetrics.rate}%`, icon: '🎯', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
                            { label: 'Traceability', value: `${traceabilityCoverage.rate}%`, icon: '🔗', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
                        ].map(kpi => (
                            <div key={kpi.label} className="stat-card" style={{ '--stat-color': kpi.color } as React.CSSProperties}>
                                <div className="stat-icon" style={{ background: kpi.bg }}><span style={{ fontSize: 18 }}>{kpi.icon}</span></div>
                                <div className="stat-value" style={{ fontSize: 24 }}>{kpi.value}</div>
                                <div className="stat-label">{kpi.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid-2 mb-6">
                        {/* Status Donut */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Overall Test Status</div>
                                <span className="badge badge-primary">{overallStats.total} total</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <ResponsiveContainer width={180} height={180}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                            {pieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ flex: 1 }}>
                                    {pieData.map(d => (
                                        <div key={d.name} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[d.name] }} />
                                                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{d.name}</span>
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                                    {d.value} ({overallStats.total > 0 ? Math.round(d.value / overallStats.total * 100) : 0}%)
                                                </span>
                                            </div>
                                            <div className="progress-bar" style={{ height: 4 }}>
                                                <div className="progress-fill" style={{ width: `${overallStats.total > 0 ? (d.value / overallStats.total * 100) : 0}%`, background: STATUS_COLORS[d.name] }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Pass Rate Trend */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Pass Rate Trend (by Run)</div>
                                {runTrendData.length >= 2 && <span className="badge badge-success">Live Trend</span>}
                            </div>
                            {runTrendData.length < 2 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                    Complete at least 2 runs to see trend data
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={runTrendData}>
                                        <defs>
                                            <linearGradient id="prGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                                        <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Pass Rate']} />
                                        <Area type="monotone" dataKey="passRate" stroke="#3b82f6" fill="url(#prGrad)" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid-2 mb-6">
                        {/* Folder Coverage Bar */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">Pass / Fail by Folder</div></div>
                            {folderStats.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>No folder data yet</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={folderStats} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                                        <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
                                        <Bar dataKey="pass" fill="#10b981" name="Pass" radius={[0, 3, 3, 0]} stackId="a" />
                                        <Bar dataKey="fail" fill="#ef4444" name="Fail" radius={[0, 3, 3, 0]} stackId="a" />
                                        <Bar dataKey="blocked" fill="#f59e0b" name="Blocked" radius={[0, 3, 3, 0]} stackId="a" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Priority Breakdown */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">Results by Priority</div></div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={priorityStats} barSize={22}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                    <Bar dataKey="pass" fill="#10b981" name="Pass" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="fail" fill="#ef4444" name="Fail" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="notRun" fill="#475569" name="Not Run" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Radar & Automation */}
                    <div className="grid-2">
                        {/* Radar - folder quality */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">Quality Radar by Module</div></div>
                            {radarData.length < 3 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>Add at least 3 folders with test cases</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <RadarChart data={radarData}>
                                        <PolarGrid stroke="rgba(255,255,255,0.08)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                        <Radar name="Coverage" dataKey="coverage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
                                        <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Pass Rate']} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Automation Distribution */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">Automation Coverage</div></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {[
                                    { label: 'Automated', count: overallStats.automated, color: '#10b981' },
                                    { label: 'In Progress', count: overallStats.inProgress, color: '#f59e0b' },
                                    { label: 'Manual Only', count: overallStats.total - overallStats.automated - overallStats.inProgress, color: '#475569' },
                                ].map(item => {
                                    const pct = overallStats.total > 0 ? Math.round((item.count / overallStats.total) * 100) : 0;
                                    return (
                                        <div key={item.label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                                                    <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                                                </div>
                                                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.count} ({pct}%)</span>
                                            </div>
                                            <div className="progress-bar" style={{ height: 8 }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 4, transition: 'width 0.6s' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                    💡 Industry benchmark: 60–70% automation is considered excellent. Your current rate is <strong style={{ color: overallStats.automationRate >= 60 ? '#10b981' : '#f59e0b' }}>{overallStats.automationRate}%</strong>.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== RUN REPORTS TAB ===== */}
            {activeTab === 'runs' && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Execution Run Report</div>
                        <select className="form-select" style={{ maxWidth: 300 }} value={selectedRunId || ''} onChange={e => setSelectedRunId(e.target.value)}>
                            <option value="">— Select a run —</option>
                            {executionRuns.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.status})</option>
                            ))}
                        </select>
                    </div>
                    {selectedRun && selectedRunStats ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
                                {[
                                    { label: 'Total', value: selectedRunStats.total, color: 'var(--color-text-primary)', bg: 'rgba(255,255,255,0.05)' },
                                    { label: 'Pass', value: selectedRunStats.pass, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                                    { label: 'Fail', value: selectedRunStats.fail, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                                    { label: 'Blocked', value: selectedRunStats.blocked, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                                    { label: 'Not Run', value: selectedRunStats.notRun, color: '#475569', bg: 'rgba(71,85,105,0.1)' },
                                    { label: 'Pass Rate', value: `${selectedRunStats.passRate}%`, color: selectedRunStats.passRate >= 80 ? '#10b981' : selectedRunStats.passRate >= 50 ? '#f59e0b' : '#ef4444', bg: 'rgba(59,130,246,0.07)' },
                                ].map(m => (
                                    <div key={m.label} style={{ background: m.bg, borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{m.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="progress-bar" style={{ height: 10, marginBottom: 8 }}>
                                <div className="progress-fill success" style={{ width: `${selectedRunStats.passRate}%` }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                                <span>0%</span>
                                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedRunStats.passRate}% Pass Rate</span>
                                <span>100%</span>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr><th>TC ID</th><th>Title</th><th>Priority</th><th>Result</th><th>Bug Linked</th><th>Executed By</th><th>Time</th><th>Comment</th></tr>
                                    </thead>
                                    <tbody>
                                        {selectedRun.testCases.map(tcId => {
                                            const tc = state.testCases.find(t => t.id === tcId);
                                            const res = selectedRun.results[tcId];
                                            if (!tc) return null;
                                            return (
                                                <tr key={tcId}>
                                                    <td><span className="badge badge-muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{tc.tcId}</span></td>
                                                    <td style={{ fontWeight: 500, maxWidth: 250 }} className="truncate">{tc.title}</td>
                                                    <td><span className={`badge badge-${tc.priority === 'Critical' ? 'danger' : tc.priority === 'High' ? 'warning' : 'info'}`}>{tc.priority}</span></td>
                                                    <td>
                                                        {res ? <span className={`badge badge-${res.status === 'Pass' ? 'success' : res.status === 'Fail' ? 'danger' : 'warning'}`}>{res.status}</span>
                                                            : <span className="badge badge-muted">Not Run</span>}
                                                    </td>
                                                    <td>
                                                        {res?.bug
                                                            ? <span className="badge badge-danger" title={res.bug.title}>🐛 {res.bug.bugId}</span>
                                                            : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>}
                                                    </td>
                                                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{res?.executedBy || '—'}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{res?.executedAt ? new Date(res.executedAt).toLocaleTimeString() : '—'}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 180 }} className="truncate">{res?.comment || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state" style={{ padding: '30px' }}>
                            <div className="empty-state-icon">📊</div>
                            <div className="empty-state-title">Select a run to view its full report</div>
                            <div className="empty-state-desc">Choose an execution run from the dropdown above to see detailed results</div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== DEFECTS TAB ===== */}
            {activeTab === 'defects' && (
                <div>
                    {bugStats.total === 0 ? (
                        <div className="card">
                            <div className="empty-state" style={{ padding: '50px' }}>
                                <div className="empty-state-icon">🎉</div>
                                <div className="empty-state-title">No Defects Linked</div>
                                <div className="empty-state-desc">All execution runs are clean. No bugs have been linked to any test case failures.</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                                {(['Critical', 'High', 'Medium', 'Low'] as const).map(sev => {
                                    const count = bugStats.bySeverity[sev] || 0;
                                    const pct = bugStats.total > 0 ? Math.round(count / bugStats.total * 100) : 0;
                                    const colors: Record<string, string> = { Critical: '#ef4444', High: '#f59e0b', Medium: '#06b6d4', Low: '#475569' };
                                    const col = colors[sev];
                                    return (
                                        <div key={sev} className="card" style={{ background: `${col}10`, border: `1px solid ${col}30` }}>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: col }}>{count}</div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4 }}>{sev}</div>
                                            <div className="progress-bar" style={{ marginTop: 10, height: 5 }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4, transition: 'width 0.4s' }} />
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>{pct}% of all defects</div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">🐛 Defect Registry ({bugStats.total} total)</div>
                                </div>
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr><th>Bug ID</th><th>Title</th><th>Severity</th><th>Test Case</th><th>Run</th><th>Link</th></tr>
                                        </thead>
                                        <tbody>
                                            {bugStats.bugs.map((bug, i) => {
                                                const tc = testCases.find(t => t.id === bug.tcId);
                                                return (
                                                    <tr key={i}>
                                                        <td><span className="badge badge-danger" style={{ fontFamily: 'monospace' }}>{bug.bugId}</span></td>
                                                        <td style={{ fontWeight: 500 }}>{bug.title || '—'}</td>
                                                        <td><span className={`badge badge-${SEVERITY_COLORS[bug.severity] || 'muted'}`}>{bug.severity}</span></td>
                                                        <td><span className="badge badge-muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{tc?.tcId || bug.tcId}</span></td>
                                                        <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{bug.runName}</td>
                                                        <td>
                                                            {bug.url
                                                                ? <a href={bug.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)', fontSize: 12 }}>🔗 Open</a>
                                                                : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ===== COVERAGE MATRIX TAB ===== */}
            {activeTab === 'coverage' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        {/* SLA Summary */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">🎯 SLA Performance</div></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>SLA Compliance Rate</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Runs achieving ≥75% pass rate</div>
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: slaMetrics.rate >= 80 ? '#10b981' : '#f59e0b' }}>{slaMetrics.rate}%</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div style={{ padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{slaMetrics.met}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>SLA Met</div>
                                    </div>
                                    <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{slaMetrics.missed}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>SLA Missed</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Traceability */}
                        <div className="card">
                            <div className="card-header"><div className="card-title">🔗 Requirements Traceability</div></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 'var(--radius-md)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>Ticket Coverage</div>
                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tickets linked to at least one test case</div>
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>{traceabilityCoverage.rate}%</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div style={{ padding: '12px', background: 'rgba(139,92,246,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{traceabilityCoverage.linked}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Linked Tickets</div>
                                    </div>
                                    <div style={{ padding: '12px', background: 'rgba(71,85,105,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#64748b' }}>{traceabilityCoverage.total - traceabilityCoverage.linked}</div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Unlinked</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Folder coverage matrix */}
                    <div className="card">
                        <div className="card-header"><div className="card-title">📁 Module Coverage Matrix</div></div>
                        {folderStats.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-icon">📁</div><div className="empty-state-title">No folders with test cases</div></div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr><th>Module / Folder</th><th>Total TCs</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Not Run</th><th>Pass Rate</th><th>Coverage Bar</th></tr>
                                    </thead>
                                    <tbody>
                                        {folders.filter(f => testCases.some(t => t.folderId === f.id)).map(folder => {
                                            const fTCs = testCases.filter(t => t.folderId === folder.id);
                                            const pass = fTCs.filter(t => t.status === 'Pass').length;
                                            const fail = fTCs.filter(t => t.status === 'Fail').length;
                                            const blocked = fTCs.filter(t => t.status === 'Blocked').length;
                                            const notRun = fTCs.filter(t => t.status === 'Not Run' || t.status === 'Skipped').length;
                                            const total = fTCs.length;
                                            const passRate = total > 0 ? Math.round(pass / total * 100) : 0;
                                            return (
                                                <tr key={folder.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: folder.color, flexShrink: 0 }} />
                                                            <span style={{ fontWeight: 600 }}>{folder.name}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="badge badge-muted">{total}</span></td>
                                                    <td style={{ color: '#10b981', fontWeight: 600 }}>{pass}</td>
                                                    <td style={{ color: '#ef4444', fontWeight: 600 }}>{fail}</td>
                                                    <td style={{ color: '#f59e0b', fontWeight: 600 }}>{blocked}</td>
                                                    <td style={{ color: '#64748b' }}>{notRun}</td>
                                                    <td>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            color: passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444',
                                                        }}>{passRate}%</span>
                                                    </td>
                                                    <td style={{ minWidth: 120 }}>
                                                        <div className="progress-bar" style={{ height: 8 }}>
                                                            <div style={{ height: '100%', width: `${passRate}%`, background: passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />
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
            )}

            {/* ===== UTILIZATION TAB ===== */}
            {activeTab === 'utilization' && <UtilizationTab state={state} />}

            {/* ===== SCHEDULE TAB ===== */}
            {activeTab === 'schedule' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>📧 Automated Report Delivery</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                Configure scheduled reports to be automatically emailed to your team on a recurring schedule.
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={openNewSchedule} id="new-schedule-btn">
                            + New Schedule
                        </button>
                    </div>

                    {/* Info banner */}
                    <div style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        💡 <strong>How it works:</strong> Scheduled reports are generated automatically at the configured frequency and delivered to the specified email addresses. The report includes a quality summary, charts, and a configurable quality gate alert if the pass rate drops below your threshold. For self-hosted or on-premise deployments, configure your SMTP settings in the environment variables.
                    </div>

                    {scheduledReports.length === 0 ? (
                        <div className="card">
                            <div className="empty-state" style={{ padding: '60px' }}>
                                <div className="empty-state-icon">📧</div>
                                <div className="empty-state-title">No scheduled reports yet</div>
                                <div className="empty-state-desc">Create your first scheduled report to automatically email quality summaries to your team.</div>
                                <button className="btn btn-primary" onClick={openNewSchedule}>+ Create First Schedule</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {scheduledReports.map(sr => (
                                <div key={sr.id} className="card" style={{ border: sr.enabled ? '1px solid rgba(59,130,246,0.2)' : '1px solid var(--color-border)', opacity: sr.enabled ? 1 : 0.65 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                <span style={{ fontSize: 20 }}>📧</span>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{sr.name}</div>
                                                <span className={`badge badge-${sr.enabled ? 'success' : 'muted'}`}>{sr.enabled ? '● Active' : '○ Paused'}</span>
                                                <span className="badge badge-muted">{FREQUENCY_LABELS[sr.frequency]}</span>
                                                <span className="badge badge-info">{sr.format.toUpperCase()}</span>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                                {sr.emails.map(email => (
                                                    <span key={email} style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '2px 10px', color: 'var(--color-text-secondary)' }}>
                                                        ✉️ {email}
                                                    </span>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                                {sr.lastSent && <span>Last sent: {new Date(sr.lastSent).toLocaleDateString()}</span>}
                                                {sr.nextSend && sr.enabled && <span>Next: {new Date(sr.nextSend).toLocaleDateString()}</span>}
                                                <span>Quality gate: ≥{sr.qualityGateThreshold}% pass rate</span>
                                                {sr.includeCharts && <span>📊 Charts</span>}
                                                {sr.includeDefects && <span>🐛 Defects</span>}
                                                {sr.includeRunDetails && <span>▶️ Run Details</span>}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => sendTestEmail()}
                                                disabled={sendTestEmailStatus === 'sending'}
                                                title="Send a test email now"
                                            >
                                                {sendTestEmailStatus === 'sending' ? '⏳ Sending…' : sendTestEmailStatus === 'sent' ? '✅ Sent!' : '📤 Test Send'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => toggleSchedule(sr.id)} title={sr.enabled ? 'Pause' : 'Activate'}>
                                                {sr.enabled ? '⏸️' : '▶️'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEditSchedule(sr)} title="Edit">✏️</button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteSchedule(sr.id)} title="Delete">🗑️</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ===== SCHEDULE MODAL ===== */}
            {showScheduleModal && (
                <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{editSchedule ? '✏️ Edit Scheduled Report' : '📧 New Scheduled Report'}</div>
                                <div className="modal-subtitle">Configure automated report delivery to your team via email</div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowScheduleModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Report Name *</label>
                            <input
                                className="form-input"
                                placeholder="e.g. Weekly QA Summary, Daily Defect Alert"
                                value={scheduleForm.name || ''}
                                onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                                id="schedule-name-input"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Frequency</label>
                                <select className="form-select" value={scheduleForm.frequency} onChange={e => setScheduleForm({ ...scheduleForm, frequency: e.target.value as ScheduleFrequency })}>
                                    {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Report Format</label>
                                <select className="form-select" value={scheduleForm.format} onChange={e => setScheduleForm({ ...scheduleForm, format: e.target.value as ReportFormat })}>
                                    <option value="pdf">📄 PDF (print-ready)</option>
                                    <option value="html">🌐 HTML (rich email)</option>
                                    <option value="csv">📊 CSV (data only)</option>
                                    <option value="json">📦 JSON (raw data)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Recipient Email Addresses *</label>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <input
                                    className="form-input"
                                    placeholder="engineer@company.com"
                                    value={emailInput}
                                    onChange={e => setEmailInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addEmail()}
                                    id="schedule-email-input"
                                />
                                <button className="btn btn-outline" onClick={addEmail} style={{ flexShrink: 0 }}>+ Add</button>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 32 }}>
                                {(scheduleForm.emails || []).map(email => (
                                    <span key={email} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: '3px 10px', color: 'var(--color-primary-light)' }}>
                                        ✉️ {email}
                                        <button onClick={() => removeEmail(email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 2px', fontSize: 12, lineHeight: 1 }}>✕</button>
                                    </span>
                                ))}
                                {(scheduleForm.emails || []).length === 0 && (
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No recipients added yet</span>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Quality Gate Threshold (%)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <input
                                    type="range"
                                    min={50} max={100} step={5}
                                    value={scheduleForm.qualityGateThreshold || 80}
                                    onChange={e => setScheduleForm({ ...scheduleForm, qualityGateThreshold: +e.target.value })}
                                    style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                                />
                                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-primary-light)', minWidth: 44, textAlign: 'right' }}>
                                    {scheduleForm.qualityGateThreshold}%
                                </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                A ⚠️ alert will be included in the email if the pass rate drops below this threshold.
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
                            {[
                                { key: 'includeCharts', label: '📊 Include Charts' },
                                { key: 'includeDefects', label: '🐛 Include Defects' },
                                { key: 'includeRunDetails', label: '▶️ Run Details' },
                                { key: 'enabled', label: '✅ Start Active' },
                            ].map(opt => (
                                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                    <input
                                        type="checkbox"
                                        className="table-checkbox"
                                        checked={!!(scheduleForm as Record<string, unknown>)[opt.key]}
                                        onChange={e => setScheduleForm({ ...scheduleForm, [opt.key]: e.target.checked })}
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={saveSchedule}
                                disabled={!scheduleForm.name?.trim() || !(scheduleForm.emails?.length)}
                                id="save-schedule-btn"
                            >
                                💾 {editSchedule ? 'Update Schedule' : 'Create Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ===== TEAM UTILIZATION TAB ===== */
function UtilizationTab({ state }: { state: ReturnType<typeof useApp>['state'] }) {
    const [filterTeam, setFilterTeam] = useState('');

    // Aggregate execution data per user across all runs
    const userStats = useMemo(() => {
        const perUser: Record<string, { executed: number; passed: number; failed: number; blocked: number; skipped: number; teams: Set<string> }> = {};

        state.executionRuns.forEach(run => {
            Object.entries(run.results).forEach(([tcId, res]) => {
                if (!res.executedBy) return;
                const user = res.executedBy;
                if (!perUser[user]) perUser[user] = { executed: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, teams: new Set() };
                perUser[user].executed += 1;
                if (res.status === 'Pass') perUser[user].passed += 1;
                else if (res.status === 'Fail') perUser[user].failed += 1;
                else if (res.status === 'Blocked') perUser[user].blocked += 1;
                else if (res.status === 'Skipped') perUser[user].skipped += 1;
                // Find team from folder
                const folder = state.folders.find(f => f.id === run.folderId);
                if (folder?.teamId) {
                    const team = state.teams.find(t => t.id === folder.teamId);
                    if (team) perUser[user].teams.add(team.name);
                }
            });
        });

        return Object.entries(perUser).map(([name, stats]) => ({
            name,
            executed: stats.executed,
            passed: stats.passed,
            failed: stats.failed,
            blocked: stats.blocked,
            skipped: stats.skipped,
            passRate: stats.executed > 0 ? Math.round((stats.passed / stats.executed) * 100) : 0,
            teams: [...stats.teams].join(', '),
        })).filter(u => !filterTeam || u.teams.includes(state.teams.find(t => t.id === filterTeam)?.name || ''));
    }, [state.executionRuns, state.folders, state.teams, filterTeam]);

    // Aggregate by team
    const teamStats = useMemo(() => {
        const perTeam: Record<string, { executed: number; passed: number; failed: number; members: Set<string> }> = {};
        state.executionRuns.forEach(run => {
            const folder = state.folders.find(f => f.id === run.folderId);
            const teamName = folder?.teamId ? state.teams.find(t => t.id === folder.teamId)?.name : null;
            if (!teamName) return;
            if (!perTeam[teamName]) perTeam[teamName] = { executed: 0, passed: 0, failed: 0, members: new Set() };
            Object.entries(run.results).forEach(([tcId, res]) => {
                if (!res.executedBy) return;
                perTeam[teamName].executed += 1;
                perTeam[teamName].members.add(res.executedBy);
                if (res.status === 'Pass') perTeam[teamName].passed += 1;
                else if (res.status === 'Fail') perTeam[teamName].failed += 1;
            });
        });
        return Object.entries(perTeam).map(([name, stats]) => ({
            name,
            executed: stats.executed,
            passed: stats.passed,
            failed: stats.failed,
            passRate: stats.executed > 0 ? Math.round((stats.passed / stats.executed) * 100) : 0,
            members: stats.members.size,
        }));
    }, [state.executionRuns, state.folders, state.teams]);

    const chartData = useMemo(() => userStats.map(u => ({ name: u.name, Executed: u.executed, Passed: u.passed, Failed: u.failed })), [userStats]);

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 16 }}>
                <div>
                    <div className="page-title" style={{ fontSize: 18 }}>👥 Team Utilization</div>
                    <div className="page-subtitle">Who executed how many test cases across all runs</div>
                </div>
                <select className="form-select form-select-sm" style={{ maxWidth: 200 }} value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
                    <option value="">— All Teams —</option>
                    {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {/* Team Summary Cards */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
                {teamStats.map(team => (
                    <div key={team.name} className="card" style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{team.name}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0' }}>{team.executed}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>tests executed by {team.members} members</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12 }}>
                            <span style={{ color: 'var(--color-success)' }}>✅ {team.passed}</span>
                            <span style={{ color: 'var(--color-danger)' }}>❌ {team.failed}</span>
                            <span style={{ color: team.passRate >= 80 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>{team.passRate}%</span>
                        </div>
                    </div>
                ))}
                {teamStats.length === 0 && (
                    <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                        No execution data found. Run some tests first!
                    </div>
                )}
            </div>

            {/* Per-User Bar Chart */}
            {chartData.length > 0 && (
                <div className="card" style={{ marginBottom: 20, padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>📊 Per-User Execution Count</div>
                    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50 + 40)}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" fontSize={12} />
                            <YAxis type="category" dataKey="name" fontSize={12} width={90} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Executed" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="Passed" fill="#10b981" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="Failed" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Per-User Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Executed</th>
                                <th>Passed</th>
                                <th>Failed</th>
                                <th>Blocked</th>
                                <th>Skipped</th>
                                <th>Pass Rate</th>
                                <th>Teams</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userStats.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No execution data</div><div className="empty-state-desc">No test cases have been executed yet</div></div></td></tr>
                            ) : userStats.map(u => (
                                <tr key={u.name}>
                                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                                    <td>{u.executed}</td>
                                    <td style={{ color: 'var(--color-success)' }}>{u.passed}</td>
                                    <td style={{ color: 'var(--color-danger)' }}>{u.failed}</td>
                                    <td style={{ color: 'var(--color-warning)' }}>{u.blocked}</td>
                                    <td>{u.skipped}</td>
                                    <td><span className={`badge badge-${u.passRate >= 80 ? 'success' : u.passRate >= 50 ? 'warning' : 'danger'}`}>{u.passRate}%</span></td>
                                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.teams || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
