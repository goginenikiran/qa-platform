'use client';

import React, { useState, useMemo } from 'react';
import { useApp, TestCase, generateId } from '../store/AppContext';

type AgentTab = 'generate' | 'coverage' | 'confidence' | 'explain';

interface FailureItem {
  title: string;
  steps: { action: string; expectedResult: string; actualResult?: string }[];
}

export default function QAAgent() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<AgentTab>('generate');

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
            }}>🧠</span>
            QA Agent
          </div>
          <div className="page-subtitle">AI-powered test generation, coverage analysis, and release confidence</div>
        </div>
        <span style={{
          fontSize: 11, background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
          border: '1px solid rgba(139,92,246,0.3)', padding: '3px 10px',
          borderRadius: 20, fontWeight: 600,
        }}>✨ Free LLM (Gemini / OpenRouter)</span>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}>📝 Generate</button>
        <button className={`tab ${activeTab === 'coverage' ? 'active' : ''}`}
          onClick={() => setActiveTab('coverage')}>🔍 Coverage Gaps</button>
        <button className={`tab ${activeTab === 'confidence' ? 'active' : ''}`}
          onClick={() => setActiveTab('confidence')}>📊 Confidence</button>
        <button className={`tab ${activeTab === 'explain' ? 'active' : ''}`}
          onClick={() => setActiveTab('explain')}>💡 Explain Failures</button>
      </div>

      {activeTab === 'generate' && <GenerateTab state={state} dispatch={dispatch} />}
      {activeTab === 'coverage' && <CoverageTab state={state} />}
      {activeTab === 'confidence' && <ConfidenceTab state={state} />}
      {activeTab === 'explain' && <ExplainTab state={state} />}
    </div>
  );
}

/* ===== TAB 1: Generate ===== */
function GenerateTab({ state, dispatch }: { state: ReturnType<typeof useApp>['state']; dispatch: ReturnType<typeof useApp>['dispatch'] }) {
  const [requirementText, setRequirementText] = useState('');
  const [count, setCount] = useState(3);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTCs, setGeneratedTCs] = useState<{ title: string; priority: string; description: string; preconditions: string; steps: { action: string; expectedResult: string }[]; tags: string[] }[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<number>>(new Set());
  const [aiSource, setAiSource] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!requirementText.trim()) return;
    setIsGenerating(true);
    setGeneratedTCs([]);
    setSelectedGenerated(new Set());
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
        setSelectedGenerated(new Set(tcs.map((_unused: unknown, i: number) => i)));
        setAiSource('templates');
      } else {
        setAiSource(data.provider || 'ai');
        const tcs = (data.testCases || []).map((tc: { title?: string; priority?: string; description?: string; preconditions?: string; steps?: { action?: string; expectedResult?: string }[]; tags?: string[] }) => ({
          title: tc.title || 'Untitled',
          priority: (tc.priority && ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority)) ? tc.priority : 'Medium',
          description: tc.description || '',
          preconditions: tc.preconditions || '',
          steps: Array.isArray(tc.steps) ? tc.steps.map((s: { action?: string; expectedResult?: string }) => ({ action: s.action || '', expectedResult: s.expectedResult || '' })) : [],
          tags: Array.isArray(tc.tags) ? tc.tags : [],
        }));
        setGeneratedTCs(tcs);
        setSelectedGenerated(new Set(tcs.map((_unused: unknown, i: number) => i)));
      }
    } catch {
      const tcs = generateLocalTCs(requirementText, count);
      setGeneratedTCs(tcs);
      setSelectedGenerated(new Set(tcs.map((_unused: unknown, i: number) => i)));
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
    // Count existing TCs with this team prefix
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
        createdBy: 'QA Agent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedTime: gen.steps.length * 2,
        automationStatus: 'Manual',
      };
    });
    dispatch({ type: 'IMPORT_TEST_CASES', payload: newTCs });
    setGeneratedTCs([]);
  };

  const toggleGenerated = (idx: number) => {
    const next = new Set(selectedGenerated);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelectedGenerated(next);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>📝 Paste Requirements</div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              value={requirementText}
              onChange={e => setRequirementText(e.target.value)}
              placeholder="Paste your requirements or acceptance criteria here...&#10;&#10;e.g. User must be able to login with valid credentials.&#10;System should lock account after 3 failed attempts.&#10;Payment processing must complete within 5 seconds."
              rows={8}
              style={{ fontFamily: 'inherit' }}
            />
          </div>
          <div className="form-row" style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Count</label>
              <select className="form-select" value={count} onChange={e => setCount(+e.target.value)}>
                {[1, 2, 3, 4, 5, 10].map(n => <option key={n} value={n}>{n} test cases</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label className="form-label">Target Team</label>
              <select className="form-select" value={selectedTeam} onChange={e => {
                const teamId = e.target.value;
                setSelectedTeam(teamId);
                if (!teamId) {
                  setSelectedFolder('');
                  return;
                }
                let folder = state.folders.find(f => f.teamId === teamId && (f.type === 'release' || f.type === 'project')) || state.folders.find(f => f.teamId === teamId);
                if (!folder) {
                  const team = state.teams.find(t => t.id === teamId);
                  if (team) {
                    const newFolder = {
                      id: generateId(),
                      name: team.name,
                      description: `Auto-created folder for ${team.name}`,
                      parentId: undefined,
                      type: 'release' as const,
                      color: '#3b82f6',
                      teamId: teamId,
                      startDate: '',
                      endDate: '',
                      createdAt: new Date().toISOString(),
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
          <button className="btn btn-accent btn-lg" style={{ width: '100%' }}
            onClick={handleGenerate} disabled={!requirementText.trim() || isGenerating}>
            {isGenerating ? <>⟳ Generating...</> : '🧠 Generate Test Cases'}
          </button>
          {aiSource && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Powered by {aiSource === 'gemini' ? '✨ Gemini AI' : aiSource === 'openrouter' ? '🔗 OpenRouter (free)' : aiSource === 'templates' ? '📋 Smart Templates' : aiSource}
            </div>
          )}
        </div>
      </div>

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
                {generatedTCs.length} test cases generated
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
                  }} onClick={() => toggleGenerated(idx)}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <input type="checkbox" className="table-checkbox" checked={isSelected} onChange={() => { }} style={{ marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span className={`badge badge-${tc.priority === 'Critical' ? 'danger' : tc.priority === 'High' ? 'warning' : tc.priority === 'Medium' ? 'info' : 'muted'}`}>{tc.priority}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{tc.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{tc.description}</div>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Steps</div>
                      {tc.steps.slice(0, 2).map((s, si) => (
                        <div key={si} style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 3, paddingLeft: 8, borderLeft: '2px solid rgba(139,92,246,0.3)' }}>
                          <span style={{ fontWeight: 600 }}>#{si + 1}</span> {s.action}
                        </div>
                      ))}
                      {tc.steps.length > 2 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{tc.steps.length - 2} more</div>}
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
              <div className="empty-state-icon">🧠</div>
              <div className="empty-state-title">QA Agent Ready</div>
              <div className="empty-state-desc">Paste requirements on the left and click Generate to create intelligent test cases automatically</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== TAB 2: Coverage Gaps ===== */
function CoverageTab({ state }: { state: ReturnType<typeof useApp>['state'] }) {
  const coverageData = useMemo(() => {
    const reqsWithTCs = state.requirements.filter(r => r.linkedTestCases.length > 0);
    const reqsWithoutTCs = state.requirements.filter(r => r.linkedTestCases.length === 0);
    const totalReqs = state.requirements.length;
    const reqCoverage = totalReqs > 0 ? Math.round((reqsWithTCs.length / totalReqs) * 100) : 0;

    const moduleCoverage = state.folders
      .filter(f => f.type === 'module')
      .map(f => {
        const tcs = state.testCases.filter(tc => tc.folderId === f.id);
        return { folder: f, testCount: tcs.length, automatedCount: tcs.filter(t => t.automationStatus === 'Automated').length };
      })
      .sort((a, b) => a.testCount - b.testCount);

    const totalTCs = state.testCases.length;
    const automatedTCs = state.testCases.filter(t => t.automationStatus === 'Automated').length;
    const autoCoverage = totalTCs > 0 ? Math.round((automatedTCs / totalTCs) * 100) : 0;

    return { reqsWithTCs, reqsWithoutTCs, totalReqs, reqCoverage, moduleCoverage, totalTCs, automatedTCs, autoCoverage };
  }, [state.requirements, state.testCases, state.folders]);

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #8b5cf6, #ec4899)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>📋</div>
          <div className="stat-value">{coverageData.totalReqs}</div>
          <div className="stat-label">Total Requirements</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #10b981, #059669)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✅</div>
          <div className="stat-value">{coverageData.reqCoverage}%</div>
          <div className="stat-label">Req → TC Coverage</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #f59e0b, #d97706)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⚡</div>
          <div className="stat-value">{coverageData.autoCoverage}%</div>
          <div className="stat-label">Automation Coverage</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'linear-gradient(90deg, #ef4444, #dc2626)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>⚠️</div>
          <div className="stat-value">{coverageData.reqsWithoutTCs.length}</div>
          <div className="stat-label">Requirements without TCs</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Requirements Coverage Gaps</div>
          {coverageData.reqsWithoutTCs.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-desc">All requirements have linked test cases! 🎉</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coverageData.reqsWithoutTCs.map(req => (
                <div key={req.id} style={{
                  background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-md)', padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{req.title}</div>
                    <span className="badge badge-danger">No TCs</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Source: {req.source} — {req.description.slice(0, 80)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Module Coverage</div>
          {coverageData.moduleCoverage.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state-desc">No modules found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {coverageData.moduleCoverage.map(m => {
                const pct = Math.min(100, Math.round((m.testCount / Math.max(...coverageData.moduleCoverage.map(x => x.testCount), 1)) * 100));
                const isLow = m.testCount < 3;
                return (
                  <div key={m.folder.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{m.folder.name}</span>
                      <span style={{ color: isLow ? '#ef4444' : 'var(--color-text-muted)' }}>
                        {m.testCount} TCs · {m.automatedCount} automated
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${pct}%`,
                        background: isLow ? '#ef4444' : 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {coverageData.reqsWithoutTCs.length > 0 && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button className="btn btn-accent"
            onClick={() => {
              const firstGap = coverageData.reqsWithoutTCs[0];
              const nav = document.querySelector('[data-view="ai-generate"]') as HTMLElement;
              document.querySelector('[id="nav-ai-generate"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }}>
            🤖 Generate TCs for uncovered requirements
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== TAB 3: Confidence ===== */
function ConfidenceTab({ state }: { state: ReturnType<typeof useApp>['state'] }) {
  const releaseData = useMemo(() => {
    return state.folders
      .filter(f => f.type === 'release')
      .map(release => {
        const childModules = state.folders.filter(f => f.parentId === release.id);
        const childIds = childModules.map(m => m.id);
        const allTcs = state.testCases.filter(tc => childIds.includes(tc.folderId));
        const totalTCs = allTcs.length;
        const automatedTCs = allTcs.filter(t => t.automationStatus === 'Automated').length;
        const autoCoverage = totalTCs > 0 ? Math.round((automatedTCs / totalTCs) * 100) : 0;

        const releaseRuns = state.executionRuns.filter(r => r.folderId === release.id || childIds.includes(r.folderId));
        let passRate = 0;
        if (releaseRuns.length > 0) {
          const allResults = Object.values(releaseRuns.flatMap(r => Object.entries(r.results).map(([, v]) => v)));
          const passed = allResults.filter(r => r.status === 'Pass').length;
          passRate = allResults.length > 0 ? Math.round((passed / allResults.length) * 100) : 0;
        }

        const reqsForRelease = state.requirements.filter(r => r.linkedTestCases.some(tcId => allTcs.some(t => t.id === tcId)));
        const coveredReqs = reqsForRelease.filter(r => r.linkedTestCases.length > 0).length;
        const reqCoverage = reqsForRelease.length > 0 ? Math.round((coveredReqs / reqsForRelease.length) * 100) : 0;

        const releaseBugs = state.bugs.filter(b => b.runId && releaseRuns.some(r => r.id === b.runId)).length;
        const openBugs = state.bugs.filter(b => b.runId && releaseRuns.some(r => r.id === b.runId) && b.status !== 'Closed').length;

        const score = Math.round(
          (passRate * 0.35) + (reqCoverage * 0.25) + (autoCoverage * 0.2) + (Math.max(0, 100 - (openBugs * 10)) * 0.2)
        );

        return { release, totalTCs, automatedTCs, autoCoverage, passRate, reqCoverage, totalBugs: releaseBugs, openBugs, score };
      });
  }, [state.folders, state.testCases, state.executionRuns, state.requirements, state.bugs]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 40 }}>📊</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>Release Confidence Summary</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aggregated score = pass rate (35%) + req coverage (25%) + automation (20%) + health (20%)</div>
          </div>
        </div>
      </div>

      {releaseData.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No releases found</div>
            <div className="empty-state-desc">Create releases in Folders view to see confidence scores</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {releaseData.map(({ release, totalTCs, automatedTCs, autoCoverage, passRate, reqCoverage, totalBugs, openBugs, score }) => {
            const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
            const gradeColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
            return (
              <div key={release.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: `conic-gradient(${gradeColor} ${score}%, rgba(255,255,255,0.05) ${score}%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', flexShrink: 0,
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'var(--color-bg-card)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, fontWeight: 800, color: gradeColor,
                    }}>{grade}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{release.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{release.description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: gradeColor }}>{score}%</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Confidence Score</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <MetricBox label="Pass Rate" value={`${passRate}%`} color="#10b981" icon="✅" />
                  <MetricBox label="Req Coverage" value={`${reqCoverage}%`} color="#8b5cf6" icon="📋" />
                  <MetricBox label="Automation" value={`${autoCoverage}% (${automatedTCs}/${totalTCs})`} color="#f59e0b" icon="⚡" />
                  <MetricBox label="Open Bugs" value={`${openBugs}`} color={openBugs > 0 ? '#ef4444' : '#10b981'} icon="🐛" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px', textAlign: 'center',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ===== TAB 4: Explain Failures ===== */
function ExplainTab({ state }: { state: ReturnType<typeof useApp>['state'] }) {
  const failedRuns = useMemo(() => {
    return state.executionRuns
      .filter(run => {
        const results = Object.values(run.results);
        return results.some(r => r.status === 'Fail');
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [state.executionRuns]);

  const [selectedRunId, setSelectedRunId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedRun = state.executionRuns.find(r => r.id === selectedRunId);

  const handleExplain = async () => {
    if (!selectedRun) return;
    setIsLoading(true);
    setExplanation('');

    const failures = Object.entries(selectedRun.results)
      .filter(([, result]) => result.status === 'Fail')
      .map(([tcId, result]) => {
        const tc = state.testCases.find(t => t.id === tcId);
        return {
          title: tc?.title || tcId,
          steps: (tc?.steps || []).map(s => ({
            action: s.action,
            expectedResult: s.expectedResult,
            actualResult: s.id === result.comment ? result.comment : (result.comment || 'No result recorded'),
          })),
        };
      });

    if (failures.length === 0) {
      setExplanation('No failures found for this run.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/qa-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'failure-explanation',
          runName: selectedRun.name,
          failures,
        }),
      });
      const data = await res.json();
      setExplanation(data.explanation || 'No explanation generated.');
    } catch {
      setExplanation('Failed to get AI explanation. Check your API keys or try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>💡 Failure Explanation</div>
          <div className="form-group">
            <label className="form-label">Select a failed execution run</label>
            <select className="form-select" value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
              <option value="">— Select run —</option>
              {failedRuns.map(run => {
                const failCount = Object.values(run.results).filter(r => r.status === 'Fail').length;
                return (
                  <option key={run.id} value={run.id}>
                    {run.name} — {failCount} failure(s)
                  </option>
                );
              })}
            </select>
          </div>
          {failedRuns.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 12 }}>
              No failed execution runs found. Execute some tests first.
            </div>
          )}
          {selectedRun && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Failed test cases:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(selectedRun.results)
                  .filter(([, r]) => r.status === 'Fail')
                  .map(([tcId, r]) => {
                    const tc = state.testCases.find(t => t.id === tcId);
                    return (
                      <div key={tcId} style={{
                        background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 'var(--radius-sm)', padding: '8px 10px',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {tc?.title || tcId}
                        </div>
                        {r.comment && <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>{r.comment}</div>}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          <button className="btn btn-accent btn-lg" style={{ width: '100%', marginTop: 16 }}
            onClick={handleExplain} disabled={!selectedRunId || isLoading}>
            {isLoading ? '⟳ Analyzing failures...' : '💡 Explain Failures with AI'}
          </button>
        </div>
      </div>

      <div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Analysis</div>
          {!explanation && !isLoading && (
            <div className="empty-state">
              <div className="empty-state-icon">💡</div>
              <div className="empty-state-title">Select a run and click Explain</div>
              <div className="empty-state-desc">AI will analyze the failures and suggest root causes and fixes</div>
            </div>
          )}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12, display: 'inline-block' }} className="animate-spin">⟳</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>AI is analyzing failures...</div>
            </div>
          )}
          {explanation && !isLoading && (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function generateLocalTCs(requirement: string, count: number): { title: string; priority: string; description: string; preconditions: string; steps: { action: string; expectedResult: string }[]; tags: string[] }[] {
  const req = requirement.toLowerCase();
  const isAuth = req.includes('login') || req.includes('auth') || req.includes('password');
  const isPayment = req.includes('payment') || req.includes('checkout') || req.includes('billing');
  const isSecurity = req.includes('encrypt') || req.includes('secure') || req.includes('permission');
  const isPerformance = req.includes('second') || req.includes('performance') || req.includes('within');

  const templates: { title: string; priority: string; description: string; preconditions: string; steps: { action: string; expectedResult: string }[]; tags: string[] }[] = [];

  if (isAuth) {
    templates.push(
      { title: 'Verify successful authentication with valid credentials', priority: 'Critical', description: 'Validate positive login scenario', preconditions: 'Test user account exists', tags: ['auth', 'smoke'], steps: [
        { action: 'Navigate to login page', expectedResult: 'Login page displayed' },
        { action: 'Enter valid credentials and submit', expectedResult: 'User is logged in and redirected to dashboard' },
      ]},
      { title: 'Verify error on invalid password', priority: 'High', description: 'Ensure error handling for bad credentials', preconditions: 'Test user account exists', tags: ['auth', 'negative'], steps: [
        { action: 'Enter valid username and wrong password', expectedResult: 'Error: "Invalid username or password"' },
      ]},
    );
  }
  if (isPayment) {
    templates.push(
      { title: 'Verify successful payment flow', priority: 'Critical', description: 'Validate complete payment with valid card', preconditions: 'User has items in cart', tags: ['payment', 'smoke'], steps: [
        { action: 'Proceed to checkout with valid card details', expectedResult: 'Payment processed, confirmation shown' },
        { action: 'Verify confirmation email', expectedResult: 'Email received within 2 minutes' },
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
