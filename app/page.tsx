'use client';

import React, { Suspense } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Integrations from './views/Integrations';
import Requirements from './views/Requirements';
import TestCases from './views/TestCases';
import Folders from './views/Folders';
import Execution from './views/Execution';
import Reporting from './views/Reporting';
import AIGenerator from './views/AIGenerator';
import Automation from './views/Automation';
import Teams from './views/Teams';
import Defects from './views/Defects';
import IntegrationRuns from './views/IntegrationRuns';
import Tickets from './views/Tickets';
import QAAgent from './views/QAAgent';
import LoginRegister from './views/LoginRegister';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const { state } = useApp();

  const renderView = () => {
    switch (state.activeView) {
      case 'dashboard': return <Dashboard />;
      case 'integrations': return <Integrations />;
      case 'requirements': return <Requirements />;
      case 'testcases': return <TestCases />;
      case 'folders': return <Folders />;
      case 'execution': return <Execution />;
      case 'reporting': return <Reporting />;
      case 'ai-generate': return <AIGenerator />;
      case 'automation': return <Automation />;
      case 'teams': return <Teams />;
      case 'defects': return <Defects />;
      case 'integration': return <IntegrationRuns />;
      case 'tickets': return <Tickets />;
      case 'qa-agent': return <QAAgent />;
      default: return <Dashboard />;
    }
  };

  if (!state.currentUser) {
    return <LoginRegister />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="page-content">
          <Suspense fallback={<LoadingSpinner />}>
            <ErrorBoundary>
              {renderView()}
            </ErrorBoundary>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }} className="animate-spin">⟳</div>
        <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
