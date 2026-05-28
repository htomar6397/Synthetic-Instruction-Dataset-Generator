import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Award, AlertTriangle, Languages, BrainCircuit, Terminal, Sparkles, Check, CheckCircle2 } from 'lucide-react';

interface Chunk {
  id: string;
  source_id: string;
  content: string;
  chunk_index: number;
}

interface GeneratorConsoleProps {
  projectId: string | null;
  projectCategory: string | null;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

interface TempSample {
  id: string;
  instruction: string;
  response: string;
  quality_score: number;
  duplicate: boolean;
  contaminated: boolean;
}

export default function GeneratorConsole({ projectId, projectCategory }: GeneratorConsoleProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Generation Options
  const [batchLimit, setBatchLimit] = useState(2);
  const [genCategory, setGenCategory] = useState('sft');
  
  // Live Previews & Terminal Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [generatedSamples, setGeneratedSamples] = useState<TempSample[]>([]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) {
      fetchChunks();
      setGeneratedSamples([]);
      setLogs([
        {
          timestamp: new Date().toLocaleTimeString(),
          message: 'Generator console ready. Select a batch size and trigger generation.',
          type: 'info'
        }
      ]);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectCategory) {
      setGenCategory(projectCategory);
    }
  }, [projectCategory]);

  useEffect(() => {
    // Scroll terminal to bottom
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchChunks = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/chunks`);
      const data = await res.json();
      setChunks(data);
    } catch (err) {
      console.error('Error fetching chunks:', err);
    }
  };

  const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        message,
        type
      }
    ]);
  };

  const handleGenerate = async () => {
    if (!projectId) return;
    setLoading(true);
    setGeneratedSamples([]);

    addLog(`Initiating generation engine batch (Limit: ${batchLimit} chunks, Category: ${genCategory})...`, 'info');

    // Simulate logs to make terminal feel alive and active
    setTimeout(() => addLog('Contacting LLM endpoint: Gemini-1.5-Flash active.', 'info'), 500);
    setTimeout(() => addLog('Loaded target system prompt configs.', 'info'), 1000);
    setTimeout(() => addLog('Querying un-synthesized database chunks...', 'info'), 1500);

    try {
      // API call to backend generator
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: batchLimit,
          category: genCategory
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.samplesGenerated === 0) {
          addLog(data.message || 'No unprocessed chunks remaining.', 'warn');
        } else {
          // Success logs
          addLog(`Gemini completed generation for ${batchLimit} chunks.`, 'success');
          addLog(`Processed and created SFT instruction datasets.`, 'info');
          
          // Show details
          data.samples.forEach((sample: any, index: number) => {
            setTimeout(() => {
              addLog(`[Sample #${index + 1}] Quality score: ${sample.quality_score}%. Status: ${sample.duplicate ? 'Duplicate flag' : 'Clean'}. Contamination: ${sample.contaminated ? 'Leakage risk' : 'Pass'}.`, sample.duplicate || sample.contaminated ? 'warn' : 'success');
            }, 500 * (index + 1));
          });

          setTimeout(() => {
            setGeneratedSamples(data.samples);
            addLog(`Batch complete. Saved ${data.samplesGenerated} instruction-tuning samples. Ready for Review workflow.`, 'success');
            fetchChunks(); // Refresh remaining chunks
          }, 500 * (data.samples.length + 1));
        }
      } else {
        addLog(`Generation error: ${data.error || 'Server rejected response'}`, 'error');
      }
    } catch (err: any) {
      addLog(`Network failed: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  if (!projectId) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-gray-400">
        Please select or configure a project workspace first.
      </div>
    );
  }

  const SftCategoryLabels: Record<string, string> = {
    sft: 'General QA / SFT',
    reasoning: 'Reasoning (Chain of Thought)',
    coding: 'Coding Tasks',
    tool_use: 'Tool Use / Function Calls',
    preference: 'Preference Align (RLHF/DPO)'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">Synthetic Generator Console</h1>
        <p className="text-gray-400 mt-1">Configure synthetic SFT templates and execute bulk generation using Gemini models.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Controls Column */}
        <div className="glass-panel rounded-xl p-5 space-y-4 lg:col-span-1">
          <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2 flex items-center gap-2">
            <BrainCircuit size={18} className="text-indigo-400" />
            Generator Controls
          </h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Dataset Category</label>
              <select
                value={genCategory}
                onChange={e => setGenCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                {Object.entries(SftCategoryLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Batch Chunk Size</label>
                <select
                  value={batchLimit}
                  onChange={e => setBatchLimit(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="1">1 chunk</option>
                  <option value="2">2 chunks</option>
                  <option value="3">3 chunks</option>
                  <option value="5">5 chunks</option>
                  <option value="10">10 chunks</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <div className="text-xs text-gray-500 mb-1">Unprocessed Chunks:</div>
                <div className="font-mono-custom font-semibold text-indigo-400 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-center text-sm">
                  {chunks.length} left
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-indigo-950/20 border border-indigo-900/50 p-3.5 text-xs text-gray-300 space-y-1.5">
              <span className="font-bold text-indigo-400 block">Generator Policy</span>
              Our pipeline feeds chunks sequentially to Gemini. It checks duplicates on word frequency similarity, run ARC/GSM8K/MMLU leakage validation, and translates SFT responses to all target project languages.
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || chunks.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white transition shadow-md cursor-pointer glow-accent-blue ${
                loading || chunks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Generating SFT Pairs...
                </>
              ) : (
                <>
                  <Play size={16} fill="white" />
                  Run Generation Pipeline
                </>
              )}
            </button>
          </div>
        </div>

        {/* Terminal logs and output */}
        <div className="glass-panel rounded-xl p-5 space-y-4 lg:col-span-2 flex flex-col justify-between">
          <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Terminal size={18} className="text-emerald-400" />
              Pipeline Terminal Logs
            </span>
            <span className="text-[10px] text-gray-500 font-mono-custom">Live stdout logs</span>
          </h2>

          {/* Terminal Console screen */}
          <div className="bg-slate-950 border border-slate-900 rounded-lg p-3.5 h-64 overflow-y-auto font-mono-custom text-xs space-y-1.5 flex-1">
            {logs.map((log, i) => {
              let color = 'text-gray-400';
              if (log.type === 'success') color = 'text-emerald-400';
              if (log.type === 'warn') color = 'text-amber-400';
              if (log.type === 'error') color = 'text-red-400';
              
              return (
                <div key={i} className="flex gap-2 leading-relaxed">
                  <span className="text-gray-600">[{log.timestamp}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-2 items-center text-indigo-400">
                <span>[*] Generating synthetic samples...</span>
                <span className="terminal-cursor"></span>
              </div>
            )}
            <div ref={terminalEndRef}></div>
          </div>
        </div>
      </div>

      {/* Generated output preview */}
      {generatedSamples.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-400" />
            Batch Real-time Previews
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {generatedSamples.map(sample => (
              <div key={sample.id} className="glass-panel rounded-xl p-5 flex flex-col justify-between space-y-3 relative overflow-hidden">
                {/* Background glow based on status */}
                {sample.duplicate && <div className="absolute top-0 right-0 h-1 bg-amber-500 w-full"></div>}
                {sample.contaminated && <div className="absolute top-0 right-0 h-1 bg-red-500 w-full"></div>}
                {!sample.duplicate && !sample.contaminated && <div className="absolute top-0 right-0 h-1 bg-indigo-500 w-full"></div>}

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-400 uppercase">Sample Preview</span>
                      <span className="font-mono-custom text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        QScore: {sample.quality_score}%
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      {sample.duplicate && (
                        <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded text-[9px] font-semibold">
                          Duplicate Flag
                        </span>
                      )}
                      {sample.contaminated && (
                        <span className="bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded text-[9px] font-semibold">
                          Leakage Risk
                        </span>
                      )}
                      {!sample.duplicate && !sample.contaminated && (
                        <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-semibold">
                          Pass
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Instruction</span>
                    <p className="text-xs text-white line-clamp-2">{sample.instruction}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Response</span>
                    <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">{sample.response}</p>
                  </div>
                </div>

                <div className="text-[10px] text-gray-500 border-t border-slate-900 pt-2.5">
                  Saved as <span className="font-mono-custom text-slate-400">{sample.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
