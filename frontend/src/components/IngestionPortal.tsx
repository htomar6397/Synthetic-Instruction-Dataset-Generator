import React, { useEffect, useState } from 'react';
import { Upload, Link, AlignLeft, FileText, CheckCircle, FileUp, Sparkles, Trash2, List } from 'lucide-react';

interface Source {
  id: string;
  project_id: string;
  name: string;
  type: string;
  content: string;
  created_at: string;
}

interface Chunk {
  id: string;
  source_id: string;
  content: string;
  chunk_index: number;
  source_name: string;
}

interface IngestionPortalProps {
  projectId: string | null;
}

export default function IngestionPortal({ projectId }: IngestionPortalProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  // Form states
  const [ingestType, setIngestType] = useState<'file' | 'website' | 'pdf'>('file');
  const [sourceName, setSourceName] = useState('');
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // Custom splitting configs
  const [chunkSize, setChunkSize] = useState(600);
  const [chunkOverlap, setChunkOverlap] = useState(60);

  // Tab selections
  const [viewTab, setViewTab] = useState<'sources' | 'chunks'>('sources');

  useEffect(() => {
    if (projectId) {
      fetchSourcesAndChunks();
    }
  }, [projectId]);

  const fetchSourcesAndChunks = async () => {
    setSourcesLoading(true);
    try {
      const sRes = await fetch(`http://localhost:5001/api/projects/${projectId}/sources`);
      const sData = await sRes.json();
      setSources(sData);

      const cRes = await fetch(`http://localhost:5001/api/projects/${projectId}/chunks`);
      const cData = await cRes.json();
      setChunks(cData);
    } catch (err) {
      console.error('Error fetching sources/chunks:', err);
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('type', ingestType);
    formData.append('chunkSize', String(chunkSize));
    formData.append('chunkOverlap', String(chunkOverlap));

    if (ingestType === 'website') {
      if (!url) { setLoading(false); return; }
      formData.append('url', url);
      formData.append('name', sourceName || url);
    } else if (ingestType === 'pdf') {
      if (!file) { setLoading(false); return; }
      formData.append('file', file);
      formData.append('name', sourceName || file.name);
    } else {
      // plain text file upload or paste
      if (file) {
        formData.append('file', file);
        formData.append('name', sourceName || file.name);
      } else if (rawText) {
        formData.append('rawText', rawText);
        formData.append('name', sourceName || 'Pasted Text Block');
      } else {
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/sources`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        // Reset forms
        setSourceName('');
        setUrl('');
        setRawText('');
        setFile(null);
        // Refresh Ingest views
        await fetchSourcesAndChunks();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Ingestion failed');
      }
    } catch (err) {
      console.error('Ingestion error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source? All associated chunks and generated samples will be removed.')) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5001/api/sources/${sourceId}`, { method: 'DELETE' });
      if (res.ok) {
        setSources(sources.filter(s => s.id !== sourceId));
        setChunks(chunks.filter(c => c.source_id !== sourceId));
      }
    } catch (err) {
      console.error('Delete source error:', err);
    }
  };

  if (!projectId) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-gray-400">
        Please select or create a project workspace first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">Data Ingestion Portal</h1>
        <p className="text-gray-400 mt-1">Ingest websites, upload PDFs, paste text, and split them into character-level chunks for generation.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ingest Form Box */}
        <div className="glass-panel rounded-xl p-5 space-y-4 lg:col-span-1">
          <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            Ingest Document
          </h2>

          <div className="grid grid-cols-3 gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => { setIngestType('file'); setFile(null); }}
              className={`flex flex-col items-center gap-1.5 py-2 text-xs font-semibold rounded cursor-pointer transition ${
                ingestType === 'file' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <AlignLeft size={16} />
              Raw Text
            </button>
            <button
              onClick={() => { setIngestType('pdf'); setFile(null); }}
              className={`flex flex-col items-center gap-1.5 py-2 text-xs font-semibold rounded cursor-pointer transition ${
                ingestType === 'pdf' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileUp size={16} />
              Upload PDF
            </button>
            <button
              onClick={() => { setIngestType('website'); setFile(null); }}
              className={`flex flex-col items-center gap-1.5 py-2 text-xs font-semibold rounded cursor-pointer transition ${
                ingestType === 'website' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Link size={16} />
              Web Scraper
            </button>
          </div>

          <form onSubmit={handleIngest} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Source Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Llama3-Architecture-Details"
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {ingestType === 'website' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://wikipedia.org/wiki/Artificial_intelligence"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {ingestType === 'pdf' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Select PDF File *</label>
                <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 transition rounded-lg p-6 text-center cursor-pointer relative bg-slate-900/50">
                  <input
                    type="file"
                    required
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="mx-auto text-indigo-400 mb-2" size={24} />
                  <span className="text-xs text-gray-300 font-medium block truncate">
                    {file ? file.name : 'Choose a PDF file...'}
                  </span>
                  <span className="text-[10px] text-gray-500">Max size 10MB</span>
                </div>
              </div>
            )}

            {ingestType === 'file' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Select Text File (Optional)</label>
                  <input
                    type="file"
                    accept=".txt,.json,.csv,.md"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-400 bg-slate-900 border border-slate-800 rounded px-2 py-1.5"
                  />
                </div>
                
                {!file && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300">Or Paste Text Content *</label>
                    <textarea
                      required
                      placeholder="Paste your raw knowledge base article or documentation here..."
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-36 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Splitting parameters */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="font-semibold text-xs text-white">Text Splitting Rules</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">Chunk Size (chars)</label>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    value={chunkSize}
                    onChange={e => setChunkSize(parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">Overlap (chars)</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={chunkOverlap}
                    onChange={e => setChunkOverlap(parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white transition shadow-md cursor-pointer glow-accent-blue ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Ingesting Data...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Ingest Source
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sources / Chunks Viewer Box */}
        <div className="glass-panel rounded-xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewTab('sources')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition ${
                  viewTab === 'sources' ? 'bg-slate-800 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText size={14} />
                Documents ({sources.length})
              </button>
              <button
                onClick={() => setViewTab('chunks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition ${
                  viewTab === 'chunks' ? 'bg-slate-800 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <List size={14} />
                Text Chunks ({chunks.length})
              </button>
            </div>

            <span className="text-[10px] text-gray-500 font-mono-custom">Project Workspace Scope</span>
          </div>

          {sourcesLoading ? (
            <div className="flex justify-center h-48 items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : viewTab === 'sources' ? (
            // Sources List
            <div className="overflow-x-auto">
              {sources.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  No documents ingested yet. Paste a block of text, upload a PDF, or scrape a URL above to populate chunks.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Chunks</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-xs text-gray-300">
                    {sources.map(s => {
                      const sChunks = chunks.filter(c => c.source_id === s.id);
                      return (
                        <tr key={s.id} className="hover:bg-slate-900/30">
                          <td className="py-3 px-3 font-semibold text-white truncate max-w-[150px]">{s.name}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              s.type === 'pdf' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              s.type === 'website' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                              'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}>
                              {s.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono-custom text-indigo-400">{sChunks.length}</td>
                          <td className="py-3 px-3 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleDeleteSource(s.id)}
                              className="text-gray-500 hover:text-red-400 transition p-1 rounded hover:bg-slate-950"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            // Chunks Scroll view
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {chunks.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  No text chunks available. Ingest some content first!
                </div>
              ) : (
                chunks.map(c => (
                  <div key={c.id} className="rounded-lg bg-slate-950 border border-slate-900 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold">
                      <span className="text-gray-400 truncate max-w-[200px]">Doc: {c.source_name}</span>
                      <span className="font-mono-custom bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-indigo-400">
                        Index #{c.chunk_index}
                      </span>
                    </div>
                    <p className="text-gray-300 leading-relaxed font-mono-custom text-[11px] whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
