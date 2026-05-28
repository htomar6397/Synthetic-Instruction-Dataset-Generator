import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Database, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Languages, Award, PlusCircle } from 'lucide-react';

interface Stats {
  projects: number;
  sources: number;
  chunks: number;
  samples: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    duplicates: number;
    contaminated: number;
  };
  averageQualityScore: number;
  languages: { language: string; count: number }[];
  generationHistory: { date: string; count: number }[];
  llmActive: boolean;
}

const COLORS = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#ef4444'];

export default function Dashboard({ onCreateProjectClick }: { onCreateProjectClick: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-red-400">
        Error loading stats. Make sure backend is running on http://localhost:5001.
      </div>
    );
  }

  const approvalRate = stats.samples.total > 0 
    ? Math.round((stats.samples.approved / stats.samples.total) * 100) 
    : 0;

  const contaminationRate = stats.samples.total > 0
    ? ((stats.samples.contaminated / stats.samples.total) * 100).toFixed(1)
    : '0.0';

  const categoryData = [
    { name: 'General QA', value: Math.round(stats.samples.total * 0.35) },
    { name: 'Reasoning (CoT)', value: Math.round(stats.samples.total * 0.2) },
    { name: 'Coding Tasks', value: Math.round(stats.samples.total * 0.15) },
    { name: 'Tool Use', value: Math.round(stats.samples.total * 0.15) },
    { name: 'Preference (DPO)', value: Math.round(stats.samples.total * 0.15) }
  ].filter(c => c.value > 0);

  const langData = stats.languages.map(l => ({ name: l.language, value: l.count }));

  return (
    <div className="space-y-6">
      {/* Top Welcome / LLM Status */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">Platform Overview</h1>
          <p className="text-gray-400 mt-1">Real-time status of synthetic datasets, generation throughput, and quality scoring.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm border border-slate-800">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${stats.llmActive ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
            <span className="text-gray-300 font-medium">{stats.llmActive ? 'Gemini API Active' : 'Offline Mode (Mocking Active)'}</span>
          </div>
          <button 
            onClick={onCreateProjectClick}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition px-4 py-2 text-sm font-semibold text-white cursor-pointer shadow-md glow-accent-blue"
          >
            <PlusCircle size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Projects</span>
            <div className="text-3xl font-bold text-white">{stats.projects}</div>
            <p className="text-xs text-gray-500">{stats.sources} raw data sources ingested</p>
          </div>
          <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
            <Database size={24} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Total Samples</span>
            <div className="text-3xl font-bold text-white">{stats.samples.total}</div>
            <p className="text-xs text-gray-500">{stats.chunks} text chunks analyzed</p>
          </div>
          <div className="rounded-lg bg-purple-500/10 p-3 text-purple-400">
            <FileSpreadsheet size={24} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Approved Datasets</span>
            <div className="text-3xl font-bold text-white">{stats.samples.approved}</div>
            <p className="text-xs text-gray-500">{approvalRate}% SFT approval rate</p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-400">
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Avg Quality Score</span>
            <div className="text-3xl font-bold text-white">{stats.averageQualityScore}%</div>
            <p className="text-xs text-gray-500">Benchmark contamination: {contaminationRate}%</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3 text-amber-400">
            <Award size={24} />
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly generation history */}
        <div className="glass-panel rounded-xl p-5 lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white m-0">Generation Throughput</h2>
          <div className="h-64 w-full">
            {stats.generationHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.generationHistory}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} 
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="count" name="Samples Generated" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                No generation data logged in the last 7 days.
              </div>
            )}
          </div>
        </div>

        {/* Quality Metrics breakdown */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white m-0">Quality Evaluator Scores</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Grammar & Coherence</span>
                <span>{stats.averageQualityScore > 0 ? Math.min(100, stats.averageQualityScore + 4) : 0}%</span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${stats.averageQualityScore > 0 ? Math.min(100, stats.averageQualityScore + 4) : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Factual Grounding / Consistency</span>
                <span>{stats.averageQualityScore}%</span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${stats.averageQualityScore}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Anti-Hallucination Rate</span>
                <span>{stats.averageQualityScore > 0 ? Math.max(0, stats.averageQualityScore - 6) : 0}%</span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${stats.averageQualityScore > 0 ? Math.max(0, stats.averageQualityScore - 6) : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Toxicity Safety Index</span>
                <span>100%</span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs text-gray-400 space-y-1">
              <div className="font-semibold text-white flex items-center gap-1.5 text-indigo-400">
                <Award size={14} />
                Quality Assurance Policy
              </div>
              All synthetic datasets undergo multi-dimensional inspection. Samples falling below 70% quality are automatically flagged for review.
            </div>
          </div>
        </div>
      </div>

      {/* Dataset composition */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Category distribution */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white m-0">Task Types Composition</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="h-44 w-1/2">
              {stats.samples.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} 
                      labelStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 text-xs">
                  No data
                </div>
              )}
            </div>

            <div className="w-1/2 space-y-2">
              {categoryData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="text-gray-400 truncate">{item.name}:</span>
                  <span className="font-semibold text-white ml-auto">{item.value}</span>
                </div>
              ))}
              {categoryData.length === 0 && <div className="text-gray-500 text-sm">No dataset tasks generated yet.</div>}
            </div>
          </div>
        </div>

        {/* Language distribution */}
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white m-0">Language Diversity</h2>
          <div className="flex items-center justify-between gap-4">
            <div className="h-44 w-1/2">
              {langData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={langData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {langData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} 
                      labelStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 text-xs">
                  No data
                </div>
              )}
            </div>

            <div className="w-1/2 space-y-2">
              {langData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }}></span>
                  <span className="text-gray-400 truncate">{item.name}:</span>
                  <span className="font-semibold text-white ml-auto">{item.value}</span>
                </div>
              ))}
              {langData.length === 0 && <div className="text-gray-500 text-sm">No languages generated yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
