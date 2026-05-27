import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FolderKanban, FileInput, PlayCircle, Eye, Download, Info, Cpu, RefreshCw } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ProjectManager from './components/ProjectManager';
import IngestionPortal from './components/IngestionPortal';
import GeneratorConsole from './components/GeneratorConsole';
import ReviewWorkflow from './components/ReviewWorkflow';
import ExportHub from './components/ExportHub';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'ingest' | 'generate' | 'review' | 'export'>('dashboard');
  
  // Workspace Shared State
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [activeProjectCategory, setActiveProjectCategory] = useState<string | null>(null);
  const [activeProjectStats, setActiveProjectStats] = useState<{ totalSamples: number; approved: number; duplicates: number } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Attempt to load previously active project from localStorage
    const savedId = localStorage.getItem('sidg_active_project_id');
    if (savedId) {
      setActiveProjectId(savedId);
    } else {
      // Fetch available projects and pick the first one
      fetchFirstProject();
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('sidg_active_project_id', activeProjectId);
      fetchProjectDetails();
    } else {
      localStorage.removeItem('sidg_active_project_id');
      setActiveProjectName(null);
      setActiveProjectCategory(null);
      setActiveProjectStats(null);
    }
  }, [activeProjectId]);

  const fetchFirstProject = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/projects');
      const data = await res.json();
      if (data.length > 0) {
        setActiveProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching first project:', err);
    }
  };

  const fetchProjectDetails = async () => {
    if (!activeProjectId) return;
    setSyncing(true);
    try {
      // Name & category
      const pRes = await fetch(`http://localhost:5001/api/projects/${activeProjectId}`);
      if (pRes.ok) {
        const pData = await pRes.json();
        setActiveProjectName(pData.name);
        setActiveProjectCategory(pData.category);
      }

      // Quick stats
      const sRes = await fetch(`http://localhost:5001/api/projects/${activeProjectId}/stats`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setActiveProjectStats({
          totalSamples: sData.totalSamples,
          approved: sData.approved,
          duplicates: sData.duplicates
        });
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Switch tab helper
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onCreateProjectClick={() => setActiveTab('projects')} />;
      case 'projects':
        return <ProjectManager activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId} />;
      case 'ingest':
        return <IngestionPortal projectId={activeProjectId} />;
      case 'generate':
        return <GeneratorConsole projectId={activeProjectId} projectCategory={activeProjectCategory} />;
      case 'review':
        return <ReviewWorkflow projectId={activeProjectId} />;
      case 'export':
        return <ExportHub projectId={activeProjectId} />;
      default:
        return <Dashboard onCreateProjectClick={() => setActiveTab('projects')} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'ingest', label: 'Ingestion Portal', icon: FileInput, requiresProject: true },
    { id: 'generate', label: 'Generator Console', icon: PlayCircle, requiresProject: true },
    { id: 'review', label: 'Human Review', icon: Eye, requiresProject: true },
    { id: 'export', label: 'Export Hub', icon: Download, requiresProject: true }
  ];

  return (
    <div className="flex h-screen overflow-hidden text-gray-200 bg-[#070b13]">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0a0f1d] border-r border-slate-900 flex flex-col justify-between flex-shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-indigo-600 p-2 text-white shadow-md glow-accent-blue animate-pulse-glow">
              <Cpu size={20} />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider text-white block">SID GENERATOR</span>
              <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">AI Dataset Platform</span>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const disabled = item.requiresProject && !activeProjectId;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                disabled={disabled}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-sm glow-accent-blue' 
                    : disabled 
                      ? 'text-gray-600 opacity-40 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Workspace Quick-State Info */}
        <div className="p-4 border-t border-slate-900 space-y-3">
          {activeProjectId ? (
            <div className="rounded-lg bg-slate-950 border border-slate-900/80 p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                <span>Active Project</span>
                <button 
                  onClick={fetchProjectDetails}
                  className="text-gray-400 hover:text-indigo-400 transition"
                  disabled={syncing}
                >
                  <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="font-bold text-white truncate">{activeProjectName || 'Loading...'}</div>

              {activeProjectStats && (
                <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-400 font-mono-custom pt-1 border-t border-slate-900">
                  <div>Samples: <span className="text-white font-semibold">{activeProjectStats.totalSamples}</span></div>
                  <div>Approved: <span className="text-emerald-400 font-semibold">{activeProjectStats.approved}</span></div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-indigo-950/10 border border-indigo-950/30 p-3 text-center text-xs text-indigo-400 font-medium space-y-2">
              <Info size={16} className="mx-auto" />
              <span>Configure a project workspace to begin ingestion.</span>
              <button 
                onClick={() => setActiveTab('projects')}
                className="w-full py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition shadow cursor-pointer"
              >
                Go to Projects
              </button>
            </div>
          )}
          <div className="text-center text-[9px] text-gray-600 font-semibold tracking-wider">
            v1.0.0 • Google DeepMind Pair
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#070b13]">
        
        {/* Glassmorphic Top Navbar */}
        <header className="h-16 border-b border-slate-900 bg-[#080d1a]/50 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0">
          <div className="text-xs text-gray-400 font-semibold">
            {activeProjectId ? (
              <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                <Cpu size={14} />
                Workspace: <span className="text-white">{activeProjectName}</span>
              </span>
            ) : (
              'No project workspace selected'
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-400">
            <div>API Port: <span className="text-emerald-400 font-mono-custom">5001</span></div>
            <div className="h-4 w-px bg-slate-900"></div>
            <div>Env Status: <span className="text-emerald-400">Localhost DEV</span></div>
          </div>
        </header>

        {/* Scrollable Workstation Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
