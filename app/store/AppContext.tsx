'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// ===== TYPES =====
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TestStatus = 'Not Run' | 'Pass' | 'Fail' | 'Blocked' | 'Skipped';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error';
export type Permission = 'create' | 'edit' | 'delete' | 'execute' | 'manage_teams' | 'manage_users' | 'view_reports';

export interface Integration {
    id: string;
    name: string;
    type: 'servicenow' | 'jira' | 'azure' | 'github' | 'custom';
    status: IntegrationStatus;
    config: Record<string, string>;
    lastSync?: string;
    icon: string;
    color: string;
}

export interface TestStep {
    id: string;
    stepNumber: number;
    action: string;
    expectedResult: string;
    actualResult?: string;
    status?: TestStatus;
}

export interface TestCase {
    id: string;
    tcId: string;
    title: string;
    description: string;
    module: string;
    folderId: string;
    priority: Priority;
    status: TestStatus;
    preconditions: string;
    steps: TestStep[];
    tags: string[];
    assignee?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    estimatedTime?: number;
    automationStatus: 'Manual' | 'Automated' | 'In Progress';
    requirementId?: string;
    ticketIds?: string[];
}

export type Role = 'Admin' | 'Lead' | 'Tester';
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    Admin: ['create', 'edit', 'delete', 'execute', 'manage_teams', 'manage_users', 'view_reports'],
    Lead: ['create', 'edit', 'delete', 'execute', 'view_reports'],
    Tester: ['create', 'edit', 'execute', 'view_reports'],
};

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    teamIds: string[];
    avatar?: string;
}

export function hasPermission(user: User | null, permission: Permission): boolean {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export interface Team {
    id: string;
    name: string;
    description: string;
}

export interface Folder {
    id: string;
    name: string;
    description: string;
    parentId?: string;
    type: 'project' | 'release' | 'module';
    color: string;
    createdAt: string;
    testCaseCount?: number;
    teamId?: string;
    startDate?: string;
    endDate?: string;
}

export interface Bug {
    id: string;
    bugId: string;
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    url?: string;
    description?: string;
    runId?: string;
    tcId?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface ExecutionRun {
    id: string;
    name: string;
    folderId: string;
    testCases: string[];
    results: Record<string, { status: TestStatus; comment?: string; executedAt?: string; executedBy?: string; bugId?: string; bug?: Bug; screenshotUrls?: string[] }>;
    startedAt: string;
    completedAt?: string;
    createdBy: string;
    status: 'In Progress' | 'Completed' | 'Aborted';
    environment?: string;
    isIntegration?: boolean;
    release?: string;
    integrationFolderIds?: string[];
}

export interface Requirement {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string;
    source: string;
    linkedTestCases: string[];
    folderId?: string;
    assignee?: string;
    createdAt: string;
}

export interface Ticket {
    id: string;
    ticketId: string;
    title: string;
    description: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    platform: 'jira' | 'servicenow' | 'azure' | 'github' | 'manual';
    assignee?: string;
    linkedTestCases: string[];
    folderId?: string;
    teamIds: string[];
    createdAt: string;
    updatedAt: string;
    lastSyncAt?: string;
}

export interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    userName: string;
    details: string;
    timestamp: string;
}

// ===== STATE =====
export interface AppState {
    integrations: Integration[];
    folders: Folder[];
    testCases: TestCase[];
    executionRuns: ExecutionRun[];
    requirements: Requirement[];
    users: User[];
    teams: Team[];
    currentUser: User | null;
    activeView: string;
    selectedFolderId: string | null;
    selectedTestCaseId: string | null;
    activeRunId: string | null;
    tickets: Ticket[];
    bugs: Bug[];
    auditLogs: AuditLog[];
}

// ===== ACTIONS =====
type Action =
    | { type: 'SET_VIEW'; payload: string }
    | { type: 'SET_SELECTED_FOLDER'; payload: string | null }
    | { type: 'SET_SELECTED_TC'; payload: string | null }
    | { type: 'ADD_INTEGRATION'; payload: Integration }
    | { type: 'UPDATE_INTEGRATION'; payload: Integration }
    | { type: 'DELETE_INTEGRATION'; payload: string }
    | { type: 'ADD_FOLDER'; payload: Folder }
    | { type: 'UPDATE_FOLDER'; payload: Folder }
    | { type: 'DELETE_FOLDER'; payload: string }
    | { type: 'ADD_TEST_CASE'; payload: TestCase }
    | { type: 'UPDATE_TEST_CASE'; payload: TestCase }
    | { type: 'DELETE_TEST_CASE'; payload: string }
    | { type: 'IMPORT_TEST_CASES'; payload: TestCase[] }
    | { type: 'ADD_EXECUTION_RUN'; payload: ExecutionRun }
    | { type: 'UPDATE_EXECUTION_RUN'; payload: ExecutionRun }
    | { type: 'SET_ACTIVE_RUN'; payload: string | null }
    | { type: 'ADD_REQUIREMENT'; payload: Requirement }
    | { type: 'UPDATE_REQUIREMENT'; payload: Requirement }
    | { type: 'DELETE_REQUIREMENT'; payload: string }
    | { type: 'ADD_USER'; payload: User }
    | { type: 'UPDATE_USER'; payload: User }
    | { type: 'DELETE_USER'; payload: string }
    | { type: 'ADD_TEAM'; payload: Team }
    | { type: 'UPDATE_TEAM'; payload: Team }
    | { type: 'DELETE_TEAM'; payload: string }
    | { type: 'SET_CURRENT_USER'; payload: User | null }
    | { type: 'LOAD_STATE'; payload: AppState }
    | { type: 'ADD_TICKET'; payload: Ticket }
    | { type: 'UPDATE_TICKET'; payload: Ticket }
    | { type: 'DELETE_TICKET'; payload: string }
    | { type: 'LINK_TC_TO_TICKET'; payload: { ticketId: string; testCaseId: string } }
    | { type: 'UNLINK_TC_FROM_TICKET'; payload: { ticketId: string; testCaseId: string } }
    | { type: 'SYNC_INTEGRATION_TICKETS'; payload: Ticket[] }
    | { type: 'ADD_BUG'; payload: Bug }
    | { type: 'UPDATE_BUG'; payload: Bug }
    | { type: 'DELETE_BUG'; payload: string }
    | { type: 'ADD_AUDIT_LOG'; payload: AuditLog };

// ===== INITIAL DATA =====
const initialFolders: Folder[] = [
    { id: 'f1', name: 'AWS Productions', description: 'AWS product suite', type: 'project', color: '#3b82f6', createdAt: '2025-06-01T00:00:00Z' },
    { id: 'f2', name: 'Release 1', description: 'Current active release cycle', type: 'release', color: '#8b5cf6', parentId: 'f1', createdAt: '2025-06-01T00:00:00Z' },
    { id: 'f3', name: 'AWSLYR — Lyrics Service', description: 'Lyric management and search', type: 'module', color: '#10b981', parentId: 'f2', createdAt: '2025-06-02T00:00:00Z', teamId: 't1' },
    { id: 'f4', name: 'AWSDKO — Docker Orchestration', description: 'Container deployment and orchestration', type: 'module', color: '#f59e0b', parentId: 'f2', createdAt: '2025-06-02T00:00:00Z', teamId: 't2' },
    { id: 'f5', name: 'AWSLC — License Compliance', description: 'License validation and compliance checks', type: 'module', color: '#ef4444', parentId: 'f2', createdAt: '2025-06-02T00:00:00Z', teamId: 't3' },
    { id: 'f6', name: 'AWSPORTAL — Portal UI', description: 'AWS customer portal frontend', type: 'module', color: '#06b6d4', parentId: 'f2', createdAt: '2025-06-02T00:00:00Z', teamId: 't4' },
    { id: 'f7', name: 'Release 2', description: 'Next release cycle', type: 'release', color: '#8b5cf6', parentId: 'f1', createdAt: '2025-06-03T00:00:00Z' },
    { id: 'f8', name: 'AWSLYR — Lyrics Service', description: 'Lyric management v2', type: 'module', color: '#10b981', parentId: 'f7', createdAt: '2025-06-03T00:00:00Z', teamId: 't1' },
    { id: 'f9', name: 'AWSDKO — Docker Orchestration', description: 'Container deployment v2', type: 'module', color: '#f59e0b', parentId: 'f7', createdAt: '2025-06-03T00:00:00Z', teamId: 't2' },
    { id: 'f10', name: 'AWSLC — License Compliance', description: 'License compliance v2', type: 'module', color: '#ef4444', parentId: 'f7', createdAt: '2025-06-03T00:00:00Z', teamId: 't3' },
    { id: 'f11', name: 'AWSPORTAL — Portal UI', description: 'Portal enhancements v2', type: 'module', color: '#06b6d4', parentId: 'f7', createdAt: '2025-06-03T00:00:00Z', teamId: 't4' },
];

const initialRequirements: Requirement[] = [];

const initialTestCases: TestCase[] = [];

const initialTickets: Ticket[] = [];

const initialIntegrations: Integration[] = [
    {
        id: 'i1', name: 'ServiceNow - Production', type: 'servicenow', status: 'connected',
        config: { instanceUrl: 'https://dev12345.service-now.com', username: 'admin', syncTable: 'incident' },
        lastSync: '2026-05-19T18:00:00Z', icon: '❄️', color: '#00a79d',
    },
    {
        id: 'i2', name: 'Jira Software', type: 'jira', status: 'disconnected',
        config: { baseUrl: '', projectKey: '' },
        icon: '🔷', color: '#0052cc',
    },
];

const initialExecutionRuns: ExecutionRun[] = [];

const initialUsers: User[] = [
    { id: 'u1', name: 'Venkat (Admin)', email: 'venkat@qacopilot.com', role: 'Admin', teamIds: [] },
    { id: 'u2', name: 'Sneha (Lead)', email: 'sneha@qacopilot.com', role: 'Lead', teamIds: ['t1', 't2'] },
    { id: 'u3', name: 'Ravi (Tester)', email: 'ravi@qacopilot.com', role: 'Tester', teamIds: ['t3', 't4'] },
];

const initialTeams: Team[] = [
    { id: 't1', name: 'AWSLYR', description: 'Lyrics Service team — lyric management and search features' },
    { id: 't2', name: 'AWSDKO', description: 'Docker Orchestration team — container deployment and infrastructure' },
    { id: 't3', name: 'AWSLC', description: 'License Compliance team — license validation and compliance' },
    { id: 't4', name: 'AWSPORTAL', description: 'Portal UI team — customer portal frontend development' },
];

const initialBugs: Bug[] = [];

const initialAuditLogs: AuditLog[] = [];

const initialState: AppState = {
    integrations: initialIntegrations,
    folders: initialFolders,
    testCases: initialTestCases,
    executionRuns: initialExecutionRuns,
    requirements: initialRequirements,
    users: initialUsers,
    teams: initialTeams,
    currentUser: null,
    activeView: 'dashboard',
    selectedFolderId: null,
    selectedTestCaseId: null,
    activeRunId: null,
    tickets: initialTickets,
    bugs: initialBugs,
    auditLogs: initialAuditLogs,
};

// ===== REDUCER =====
function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'LOAD_STATE': return action.payload;
        case 'SET_VIEW': return { ...state, activeView: action.payload };
        case 'SET_SELECTED_FOLDER': return { ...state, selectedFolderId: action.payload };
        case 'SET_SELECTED_TC': return { ...state, selectedTestCaseId: action.payload };
        case 'ADD_INTEGRATION': return { ...state, integrations: [...state.integrations, action.payload] };
        case 'UPDATE_INTEGRATION': return { ...state, integrations: state.integrations.map(i => i.id === action.payload.id ? action.payload : i) };
        case 'DELETE_INTEGRATION': return { ...state, integrations: state.integrations.filter(i => i.id !== action.payload) };
        case 'ADD_FOLDER': return { ...state, folders: [...state.folders, action.payload] };
        case 'UPDATE_FOLDER': return { ...state, folders: state.folders.map(f => f.id === action.payload.id ? action.payload : f) };
        case 'DELETE_FOLDER': {
            const folderId = action.payload;
            const childIds: string[] = [];
            const collectChildren = (parentId: string) => {
                state.folders.forEach(f => {
                    if (f.parentId === parentId) {
                        childIds.push(f.id);
                        collectChildren(f.id);
                    }
                });
            };
            collectChildren(folderId);
            const allIds = [folderId, ...childIds];
            return {
                ...state,
                folders: state.folders.filter(f => !allIds.includes(f.id)),
                testCases: state.testCases.map(tc => allIds.includes(tc.folderId) ? { ...tc, folderId: '' } : tc),
            };
        }
        case 'ADD_TEST_CASE': return { ...state, testCases: [...state.testCases, action.payload] };
        case 'UPDATE_TEST_CASE': return { ...state, testCases: state.testCases.map(t => t.id === action.payload.id ? action.payload : t) };
        case 'DELETE_TEST_CASE': {
            const tcId = action.payload;
            return {
                ...state,
                testCases: state.testCases.filter(t => t.id !== tcId),
                tickets: state.tickets.map(t => ({
                    ...t,
                    linkedTestCases: (t.linkedTestCases || []).filter(id => id !== tcId)
                }))
            };
        }
        case 'IMPORT_TEST_CASES': return { ...state, testCases: [...state.testCases, ...action.payload] };
        case 'ADD_EXECUTION_RUN': return { ...state, executionRuns: [...state.executionRuns, action.payload] };
        case 'UPDATE_EXECUTION_RUN': return { ...state, executionRuns: state.executionRuns.map(r => r.id === action.payload.id ? action.payload : r) };
        case 'SET_ACTIVE_RUN': return { ...state, activeRunId: action.payload };
        case 'ADD_REQUIREMENT': return { ...state, requirements: [...state.requirements, action.payload] };
        case 'UPDATE_REQUIREMENT': return { ...state, requirements: state.requirements.map(r => r.id === action.payload.id ? action.payload : r) };
        case 'DELETE_REQUIREMENT': return { ...state, requirements: state.requirements.filter(r => r.id !== action.payload) };
        case 'ADD_USER': return { ...state, users: [...state.users, action.payload] };
        case 'UPDATE_USER': return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
        case 'DELETE_USER': return { ...state, users: state.users.filter(u => u.id !== action.payload), currentUser: state.currentUser?.id === action.payload ? null : state.currentUser };
        case 'ADD_TEAM': return { ...state, teams: [...state.teams, action.payload] };
        case 'UPDATE_TEAM': return { ...state, teams: state.teams.map(t => t.id === action.payload.id ? action.payload : t) };
        case 'DELETE_TEAM': return { ...state, teams: state.teams.filter(t => t.id !== action.payload) };
        case 'SET_CURRENT_USER': return { ...state, currentUser: action.payload };
        case 'ADD_TICKET': return { ...state, tickets: [...state.tickets, action.payload] };
        case 'UPDATE_TICKET': return { ...state, tickets: state.tickets.map(t => t.id === action.payload.id ? action.payload : t) };
        case 'DELETE_TICKET': return { ...state, tickets: state.tickets.filter(t => t.id !== action.payload) };
        case 'LINK_TC_TO_TICKET': {
            const { ticketId, testCaseId } = action.payload;
            return {
                ...state,
                tickets: state.tickets.map(t => {
                    if (t.id === ticketId && !t.linkedTestCases.includes(testCaseId)) {
                        return { ...t, linkedTestCases: [...t.linkedTestCases, testCaseId] };
                    }
                    return t;
                }),
                testCases: state.testCases.map(tc => {
                    if (tc.id === testCaseId) {
                        const ticketIds = tc.ticketIds || [];
                        if (!ticketIds.includes(ticketId)) {
                            return { ...tc, ticketIds: [...ticketIds, ticketId] };
                        }
                    }
                    return tc;
                })
            };
        }
        case 'UNLINK_TC_FROM_TICKET': {
            const { ticketId, testCaseId } = action.payload;
            return {
                ...state,
                tickets: state.tickets.map(t => {
                    if (t.id === ticketId) {
                        return { ...t, linkedTestCases: t.linkedTestCases.filter(id => id !== testCaseId) };
                    }
                    return t;
                }),
                testCases: state.testCases.map(tc => {
                    if (tc.id === testCaseId) {
                        const ticketIds = tc.ticketIds || [];
                        return { ...tc, ticketIds: ticketIds.filter(id => id !== ticketId) };
                    }
                    return tc;
                })
            };
        }
        case 'SYNC_INTEGRATION_TICKETS': {
            const syncedTickets = action.payload;
            const manualTickets = state.tickets.filter(t => t.platform === 'manual');
            const filteredManual = manualTickets.filter(mt => !syncedTickets.some(st => st.ticketId === mt.ticketId));
            return {
                ...state,
                tickets: [...filteredManual, ...syncedTickets]
            };
        }
        case 'ADD_BUG': return { ...state, bugs: [...state.bugs, action.payload] };
        case 'UPDATE_BUG': return { ...state, bugs: state.bugs.map(b => b.id === action.payload.id ? action.payload : b) };
        case 'DELETE_BUG': return { ...state, bugs: state.bugs.filter(b => b.id !== action.payload) };
        case 'ADD_AUDIT_LOG': return { ...state, auditLogs: [...state.auditLogs, action.payload] };
        default: return state;
    }
}

// ===== CONTEXT =====
const AppContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    const DATA_VERSION = 5; // bumped to flush old hardcoded test cases

    // Persist to localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('qa-platform-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.dataVersion === DATA_VERSION) {
                    if (parsed.testCases) {
                        parsed.testCases = parsed.testCases.map((tc: TestCase) => ({
                            ...tc,
                            ticketIds: tc.ticketIds || []
                        }));
                    }
                    if (parsed.tickets) {
                        parsed.tickets = parsed.tickets.map((t: Ticket) => ({
                            ...t,
                            linkedTestCases: t.linkedTestCases || []
                        }));
                    }
                    parsed.bugs = parsed.bugs || [];
                    parsed.auditLogs = parsed.auditLogs || [];
                    dispatch({ type: 'LOAD_STATE', payload: { ...initialState, ...parsed } });
                } else {
                    localStorage.removeItem('qa-platform-state');
                }
            }
        } catch { }
    }, []);

    useEffect(() => {
        try {
            const toSave = {
                dataVersion: DATA_VERSION,
                integrations: state.integrations,
                folders: state.folders,
                testCases: state.testCases,
                executionRuns: state.executionRuns,
                requirements: state.requirements,
                users: state.users,
                teams: state.teams,
                currentUser: state.currentUser,
                tickets: state.tickets,
                bugs: state.bugs,
                auditLogs: state.auditLogs,
            };
            localStorage.setItem('qa-platform-state', JSON.stringify(toSave));
        } catch { }
    }, [state.integrations, state.folders, state.testCases, state.executionRuns, state.requirements, state.users, state.teams, state.currentUser, state.tickets, state.bugs, state.auditLogs]);

    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}

// ===== HELPERS =====
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getStatusColor(status: TestStatus): string {
    switch (status) {
        case 'Pass': return 'success';
        case 'Fail': return 'danger';
        case 'Blocked': return 'warning';
        case 'Skipped': return 'muted';
        case 'Not Run': return 'info';
        default: return 'muted';
    }
}

export function getPriorityColor(priority: Priority): string {
    switch (priority) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Low': return 'muted';
        default: return 'muted';
    }
}

export function calculateRunStats(run: ExecutionRun) {
    const total = run.testCases.length;
    const results = Object.values(run.results);
    const pass = results.filter(r => r.status === 'Pass').length;
    const fail = results.filter(r => r.status === 'Fail').length;
    const blocked = results.filter(r => r.status === 'Blocked').length;
    const skipped = results.filter(r => r.status === 'Skipped').length;
    const notRun = total - results.length;
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
    return { total, pass, fail, blocked, skipped, notRun, passRate };
}

/**
 * Generates a team-scoped TC ID like "LYRA-TC06", "DKO-TC02", etc.
 * Falls back to "TC-NNN" if the folder has no associated team.
 */
export function generateTeamTcId(
    folderId: string,
    folders: Folder[],
    teams: Team[],
    existingTestCases: TestCase[]
): string {
    const folder = folders.find(f => f.id === folderId);
    const team = folder?.teamId ? teams.find(t => t.id === folder.teamId) : null;
    // Derive prefix: use team name if available, else 'TC'
    const prefix = team ? team.name : 'TC';
    // Count existing TCs with this prefix across all folders of this team
    const teamFolderIds = folder?.teamId
        ? folders.filter(f => f.teamId === folder.teamId).map(f => f.id)
        : [folderId];
    const count = existingTestCases.filter(tc =>
        teamFolderIds.includes(tc.folderId) ||
        tc.tcId.toUpperCase().startsWith(prefix.toUpperCase() + '-TC')
    ).length;
    return `${prefix}-TC${String(count + 1).padStart(2, '0')}`;
}

export function audit(user: User | null, action: string, entityType: string, entityId: string, details: string): AuditLog {
    return {
        id: generateId(),
        action,
        entityType,
        entityId,
        userId: user?.id || 'unknown',
        userName: user?.name || 'Unknown',
        details,
        timestamp: new Date().toISOString(),
    };
}
