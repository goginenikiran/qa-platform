'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useApp, calculateRunStats } from '../store/AppContext';

const STATUS_COLORS: Record<string, string> = {
    Pass: '#10b981',
    Fail: '#ef4444',
    Blocked: '#f59e0b',
};

export default function Dashboard() {
    const { state, dispatch } = useApp();
    const { integrations } = state;

    const visibleFolders = useMemo(() => {
        return state.folders.filter(f => state.currentUser?.role === 'Admin' || !f.teamId || state.currentUser?.teamIds.includes(f.teamId));
    }, [state.folders, state.currentUser]);
    
    const visibleFolderIds = useMemo(() => new Set(visibleFolders.map(f => f.id)), [visibleFolders]);

    const visibleTestCases = useMemo(() => {
        return state.testCases.filter(tc => visibleFolderIds.has(tc.folderId));
    }, [state.testCases, visibleFolderIds]);

    const visibleExecutionRuns = useMemo(() => {
        const tcIds = new Set(visibleTestCases.map(tc => tc.id));
        return state.executionRuns.filter(run => run.testCases.some(tcId => tcIds.has(tcId)));
    }, [state.executionRuns, visibleTestCases]);

    const stats = useMemo(() => {
        const total = visibleTestCases.length;
        const automated = visibleTestCases.filter(t => t.automationStatus === 'Automated').length;
        const connected = integrations.filter(i => i.status === 'connected').length;
        const allRunResults = Object.values(
            visibleExecutionRuns.reduce<Record<string, { status: string }>>((acc, run) => {
                Object.entries(run.results).forEach(([tcId, result]) => {
                    acc[tcId] = result;
                });
                return acc;
            }, {})
        );
        const pass = allRunResults.filter(r => r.status === 'Pass').length;
        const fail = allRunResults.filter(r => r.status === 'Fail').length;
        const blocked = allRunResults.filter(r => r.status === 'Blocked').length;
        const totalExecuted = allRunResults.length;
        const passRate = totalExecuted > 0 ? Math.round((pass / totalExecuted) * 100) : 0;
        return { total, pass, fail, blocked, automated, connected, passRate, totalExecuted };
    }, [visibleTestCases, integrations, visibleExecutionRuns]);

    const pieData = [
        { name: 'Pass', value: stats.pass },
        { name: 'Fail', value: stats.fail },
        { name: 'Blocked', value: stats.blocked },
    ].filter(d => d.value > 0);

    const trendData = useMemo(() => {
        const dataByDate: Record<string, { pass: number; fail: number; blocked: number }> = {};
        
        visibleExecutionRuns.forEach(run => {
            const dateStr = new Date(run.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!dataByDate[dateStr]) dataByDate[dateStr] = { pass: 0, fail: 0, blocked: 0 };
            
            Object.values(run.results).forEach(result => {
                if (result.status === 'Pass') dataByDate[dateStr].pass++;
                if (result.status === 'Fail') dataByDate[dateStr].fail++;
                if (result.status === 'Blocked') dataByDate[dateStr].blocked++;
            });
        });

        if (Object.keys(dataByDate).length === 0) {
            for (let i = 5; i >= 1; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                dataByDate[dateStr] = { pass: 0, fail: 0, blocked: 0 };
            }
        }

        const sortedDates = Object.keys(dataByDate).sort((a, b) => {
            const year = new Date().getFullYear();
            return new Date(`${a} ${year}`).getTime() - new Date(`${b} ${year}`).getTime();
        });
        
        const dynamicTrend = sortedDates.map(date => ({
            date,
            pass: dataByDate[date].pass,
            fail: dataByDate[date].fail,
            blocked: dataByDate[date].blocked,
        }));

        dynamicTrend.push({ date: 'All Time', pass: stats.pass, fail: stats.fail, blocked: stats.blocked });
        return dynamicTrend;
    }, [visibleExecutionRuns, stats]);

    const priorityData = [
        { name: 'Critical', count: visibleTestCases.filter(t => t.priority === 'Critical').length },
        { name: 'High', count: visibleTestCases.filter(t => t.priority === 'High').length },
        { name: 'Medium', count: visibleTestCases.filter(t => t.priority === 'Medium').length },
        { name: 'Low', count: visibleTestCases.filter(t => t.priority === 'Low').length },
    ];

    const recentRuns = [...visibleExecutionRuns].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 5);

    return (
        <div>
            {/* Hero Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-xl)',
                padding: '28px 32px',
                marginBottom: '24px',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', top: -40, right: -40, width: 200, height: 200,
                    background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)',
                    borderRadius: '50%',
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: 28 }}>🚀</span>
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                                Welcome to QA Copilot
                            </h1>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: 0 }}>
                            Enterprise-grade test management with AI-powered generation. <strong style={{ color: 'var(--color-primary-light)' }}>{stats.passRate}% pass rate</strong> across {stats.totalExecuted} executed test cases.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                        <button className="btn btn-accent" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'ai-generate' })} id="quick-ai-generate">
                            🤖 AI Generate
                        </button>
                        <button className="btn btn-primary" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'execution' })} id="quick-run">
                            ▶️ New Run
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stat-grid">
                <StatCard
                    icon="✅" label="Total Test Cases" value={stats.total}
                    color="linear-gradient(90deg, #3b82f6, #8b5cf6)"
                    iconBg="rgba(59,130,246,0.15)" iconColor="#3b82f6"
                    change="+3 this week" changeDir="up"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'testcases' })}
                />
                <StatCard
                    icon="✔️" label="Pass Rate" value={`${stats.passRate}%`}
                    color="linear-gradient(90deg, #10b981, #059669)"
                    iconBg="rgba(16,185,129,0.15)" iconColor="#10b981"
                    change={`${stats.pass} passed in runs`} changeDir="up"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'reporting' })}
                />
                <StatCard
                    icon="❌" label="Failing in Executions" value={stats.fail}
                    color="linear-gradient(90deg, #ef4444, #dc2626)"
                    iconBg="rgba(239,68,68,0.15)" iconColor="#ef4444"
                    change="Needs attention" changeDir="down"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'execution' })}
                />
                <StatCard
                    icon="⚡" label="Automated" value={stats.automated}
                    color="linear-gradient(90deg, #f59e0b, #d97706)"
                    iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b"
                    change={`${stats.total > 0 ? Math.round(stats.automated / stats.total * 100) : 0}% coverage`} changeDir="up"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'automation' })}
                />
                <StatCard
                    icon="📁" label="Folders/Releases" value={visibleFolders.length}
                    color="linear-gradient(90deg, #8b5cf6, #7c3aed)"
                    iconBg="rgba(139,92,246,0.15)" iconColor="#8b5cf6"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'folders' })}
                />
                <StatCard
                    icon="🔗" label="Integrations" value={`${stats.connected}/${integrations.length}`}
                    color="linear-gradient(90deg, #06b6d4, #0284c7)"
                    iconBg="rgba(6,182,212,0.15)" iconColor="#06b6d4"
                    change="Active connections" changeDir="up"
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'integrations' })}
                />
            </div>

            {/* Charts Row */}
            <div className="grid-2 mb-6">
                {/* Trend Chart */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Execution Results Trend</div>
                            <div className="card-subtitle">Last 7 days + all-time run results</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
                            <Area type="monotone" dataKey="pass" stroke="#10b981" fill="url(#passGrad)" strokeWidth={2} name="Pass" />
                            <Area type="monotone" dataKey="fail" stroke="#ef4444" fill="url(#failGrad)" strokeWidth={2} name="Fail" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Status Donut */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Execution Results</div>
                            <div className="card-subtitle">Aggregated across all test runs</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <ResponsiveContainer width={160} height={160}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={STATUS_COLORS[entry.name] || '#475569'} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex: 1 }}>
                            {pieData.map(d => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[d.name] }} />
                                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{d.name}</span>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Priority & Recent Runs */}
            <div className="grid-2">
                {/* Priority Distribution */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Priority Distribution</div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={priorityData} barSize={28}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#131929', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {priorityData.map((_, i) => (
                                    <Cell key={i} fill={['#ef4444', '#f59e0b', '#06b6d4', '#475569'][i]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Recent Execution Runs */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Recent Execution Runs</div>
                        <button className="btn btn-outline btn-sm" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'execution' })}>View All</button>
                    </div>
                    {recentRuns.length === 0 ? (
                        <div className="empty-state" style={{ padding: '20px' }}>
                            <div className="empty-state-desc">No runs yet. Start your first test execution!</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {recentRuns.map(run => {
                                const st = calculateRunStats(run);
                                return (
                                    <div key={run.id} style={{
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)', padding: '10px 14px',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                        onClick={() => { dispatch({ type: 'SET_VIEW', payload: 'execution' }); dispatch({ type: 'SET_ACTIVE_RUN', payload: run.id }); }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{run.name}</span>
                                            <span className={`badge badge-${run.status === 'Completed' ? 'success' : run.status === 'In Progress' ? 'info' : 'danger'}`}>
                                                {run.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>✅ {st.pass} Pass</span>
                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>❌ {st.fail} Fail</span>
                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>⚠️ {st.blocked} Blocked</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-fill success" style={{ width: `${st.passRate}%` }} />
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{st.passRate}% pass rate</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color, iconBg, iconColor, change, changeDir, onClick }: {
    icon: string; label: string; value: string | number;
    color: string; iconBg: string; iconColor?: string;
    change?: string; changeDir?: 'up' | 'down'; onClick?: () => void;
}) {
    return (
        <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', '--stat-color': color } as React.CSSProperties}>
            <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
            {change && (
                <div className={`stat-change ${changeDir}`}>
                    {changeDir === 'up' ? '↑' : '↓'} {change}
                </div>
            )}
        </div>
    );
}
