import React, { useEffect, useState } from 'react';
import { Download, CloudUpload, History, CheckCircle2, ChevronRight, Bookmark, ArrowUpRight } from 'lucide-react';

interface Version {
  id: string;
  project_id: string;
  version_string: string;
  sample_count: number;
  change_log: string;
  metrics: string; // JSON string
  created_at: string;
}

interface ExportHubProps {
  projectId: string | null;
}

export default function ExportHub({ projectId }: ExportHubProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);

  // Local Download Settings
  const [exportFormat, setExportFormat] = useState<'json' | 'jsonl' | 'csv'>('jsonl');
  const [exportScope, setExportScope] = useState<'approved' | 'all'>('approved');

  // Hugging Face Settings
  const [repoId, setRepoId] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [split, setSplit] = useState('train');
  const [hfLoading, setHfLoading] = useState(false);
  const [hfSuccessUrl, setHfSuccessUrl] = useState<string | null>(null);

  // Version creation state
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [versionString, setVersionString] = useState('1.0.0');
  const [changeLog, setChangeLog] = useState('');
  const [versionLoading, setVersionLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchVersions();
      setHfSuccessUrl(null);
    }
  }, [projectId]);

  const fetchVersions = async () => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/versions`);
      const data = await res.json();
      setVersions(data);
    } catch (err) {
      console.error('Error fetching versions:', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!projectId) return;
    const downloadUrl = `http://localhost:5001/api/projects/${projectId}/export?format=${exportFormat}&scope=${exportScope}`;
    window.open(downloadUrl, '_blank');
  };

  const handlePushToHF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !repoId || !hfToken) return;

    setHfLoading(true);
    setHfSuccessUrl(null);

    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/export/hf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId,
          token: hfToken,
          split
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setHfSuccessUrl(data.url);
      } else {
        alert(data.error || 'Failed to push to Hugging Face');
      }
    } catch (err) {
      console.error('Hugging Face push error:', err);
    } finally {
      setHfLoading(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !versionString) return;

    setVersionLoading(true);

    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionString,
          changeLog
        })
      });

      const data = await res.json();
      if (res.ok) {
        setVersions([data, ...versions]);
        setShowVersionForm(false);
        setVersionString('');
        setChangeLog('');
      } else {
        alert(data.error || 'Failed to create release version.');
      }
    } catch (err) {
      console.error('Create version error:', err);
    } finally {
      setVersionLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-gray-400">
        Please select or configure a project workspace first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">Export & Versioning Hub</h1>
        <p className="text-gray-400 mt-1">Package approved SFT instructions, manage historical release tags, and push to Hugging Face Hub.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Local Download Column */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Download size={18} className="text-indigo-400" />
            Local Data Download
          </h2>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">File Format</label>
              <select
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="jsonl">JSON Lines (JSONL - recommended for LLMs)</option>
                <option value="json">JSON Array</option>
                <option value="csv">CSV (Spreadsheet compatibility)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Scope Selection</label>
              <select
                value={exportScope}
                onChange={e => setExportScope(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="approved">Approved Samples Only (recommended)</option>
                <option value="all">Include Pending / Edited (excludes explicitly rejected)</option>
              </select>
            </div>

            <div className="bg-slate-950 border border-slate-900 p-3 rounded-lg text-xs text-gray-400 leading-relaxed">
              Downloads will initiate a stream from SQLite directly formatting values according to your selection. In-progress/rejected samples will be filtered automatically if approved scope is selected.
            </div>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white transition shadow-md cursor-pointer glow-accent-blue"
            >
              <Download size={16} />
              Download Dataset
            </button>
          </div>
        </div>

        {/* Hugging Face Column */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2 flex items-center gap-2">
            <CloudUpload size={18} className="text-indigo-400" />
            Hugging Face Export
          </h2>

          {hfSuccessUrl ? (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-5 text-center space-y-3 animate-fade-in">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
              <h3 className="text-base font-bold text-white m-0">Push Successful!</h3>
              <p className="text-xs text-gray-300">Your instruction dataset has been pushed and compiled as a Hugging Face DatasetDict.</p>
              <a
                href={hfSuccessUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold hover:underline"
              >
                Open in Hugging Face Hub
                <ArrowUpRight size={14} />
              </a>
              <button
                onClick={() => setHfSuccessUrl(null)}
                className="block mx-auto text-[10px] text-gray-500 hover:underline pt-2"
              >
                Push Another Version
              </button>
            </div>
          ) : (
            <form onSubmit={handlePushToHF} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">HF Repository ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. username/synthetic-reasoning-sft"
                  value={repoId}
                  onChange={e => setRepoId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">HF Write Token *</label>
                  <input
                    type="password"
                    required
                    placeholder="hf_..."
                    value={hfToken}
                    onChange={e => setHfToken(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Dataset Split</label>
                  <select
                    value={split}
                    onChange={e => setSplit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="train">train (default SFT)</option>
                    <option value="test">test (validation)</option>
                    <option value="validation">validation</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={hfLoading}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white transition shadow-md cursor-pointer glow-accent-blue ${
                  hfLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {hfLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Pushing to Hugging Face...
                  </>
                ) : (
                  <>
                    <CloudUpload size={16} />
                    Push to HF Hub
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Dataset Versioning Section */}
      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h2 className="text-lg font-bold text-white m-0 flex items-center gap-2">
            <History size={18} className="text-indigo-400" />
            Release Versions Control
          </h2>
          <button
            onClick={() => setShowVersionForm(!showVersionForm)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-900 border border-slate-850 hover:border-slate-700 text-xs font-semibold text-gray-300 transition cursor-pointer"
          >
            {showVersionForm ? 'Cancel' : 'Release New Version'}
          </button>
        </div>

        {/* New Version Form */}
        {showVersionForm && (
          <form onSubmit={handleCreateVersion} className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-4 max-w-xl animate-fade-in">
            <h3 className="text-sm font-bold text-white m-0">Create Release Snapshot</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Version Tag *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1.0.0"
                  value={versionString}
                  onChange={e => setVersionString(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Release Notes / Changelog</label>
                <input
                  type="text"
                  placeholder="e.g. Added 50 reasoning pairs in Hindi"
                  value={changeLog}
                  onChange={e => setChangeLog(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={versionLoading}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white transition shadow-sm cursor-pointer"
              >
                {versionLoading ? 'Saving snapshot...' : 'Publish Release'}
              </button>
            </div>
          </form>
        )}

        {/* Versions Table list */}
        {versionsLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs">
            No versions published yet. Snapshot your approved datasets to track release history and metrics.
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map(v => {
              const metrics = v.metrics ? JSON.parse(v.metrics) : null;
              return (
                <div key={v.id} className="rounded-lg bg-slate-950 border border-slate-900/60 p-3.5 flex items-center justify-between text-xs hover:border-slate-800 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 font-bold text-white bg-indigo-600/10 border border-indigo-600/30 px-2.5 py-0.5 rounded text-[10px] font-mono-custom">
                        <Bookmark size={10} className="fill-indigo-400 text-indigo-400" />
                        v{v.version_string}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono-custom">{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-400 font-medium text-[11px]">{v.change_log || 'No changelog provided.'}</p>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-semibold text-white">
                      {v.sample_count} SFT samples
                    </div>
                    {metrics && (
                      <div className="text-[10px] text-gray-500 font-mono-custom">
                        Avg Quality: <span className="text-indigo-400 font-semibold">{metrics.averageQuality}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
