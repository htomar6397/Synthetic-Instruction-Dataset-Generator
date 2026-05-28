import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Folder, Check, AlertCircle, Cpu, Languages } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  languages: string; // JSON string array
  system_prompt: string;
  config: string; // JSON config
  created_at: string;
}

interface ProjectManagerProps {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
}

export default function ProjectManager({ activeProjectId, setActiveProjectId }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('sft');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);

  const langOptions = ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];
  const categories = [
    { value: 'sft', label: 'General QA / Supervised Fine-Tuning' },
    { value: 'reasoning', label: 'Reasoning Models (Chain of Thought)' },
    { value: 'coding', label: 'Coding Models (Programming / Explanations)' },
    { value: 'tool_use', label: 'Tool Use / Function Calling Models' },
    { value: 'preference', label: 'Preference Alignment (RLHF / DPO)' }
  ];

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/projects');
      const data = await res.json();
      setProjects(data);
      // Automatically select the first project as active if none selected
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || languages.length === 0) return;

    try {
      const res = await fetch('http://localhost:5001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          languages,
          systemPrompt,
          config: { temperature }
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProjects([data, ...projects]);
        setActiveProjectId(data.id);
        setShowForm(false);
        // Reset form
        setName('');
        setDescription('');
        setCategory('sft');
        setLanguages(['English']);
        setSystemPrompt('');
        setTemperature(0.7);
      } else {
        alert(data.error || 'Failed to create project.');
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? All associated chunks, sources, and samples will be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5001/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== id));
        if (activeProjectId === id) {
          setActiveProjectId(projects.length > 1 ? projects.find(p => p.id !== id)?.id || null : null);
        }
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleLanguageToggle = (lang: string) => {
    if (languages.includes(lang)) {
      // Don't allow removing if it's the only language left
      if (languages.length > 1) {
        setLanguages(languages.filter(l => l !== lang));
      }
    } else {
      setLanguages([...languages, lang]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">Dataset Projects</h1>
          <p className="text-gray-400 mt-1">Manage project workspaces, configuration templates, SFT category and target languages.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition px-4 py-2 text-sm font-semibold text-white cursor-pointer shadow-md glow-accent-blue"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Create Project'}
        </button>
      </div>

      {/* Form Dialog (conditional rendering) */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-panel rounded-xl p-6 space-y-4 max-w-2xl animate-fade-in">
          <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2">New Dataset Configuration</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Project Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. FineTuning-Llama3-Chemistry"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Dataset Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300">Description</label>
            <textarea
              placeholder="Provide context about what models this dataset targets..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-20 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300 block">Target Languages *</label>
            <div className="flex flex-wrap gap-2">
              {langOptions.map(lang => {
                const selected = languages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleLanguageToggle(lang)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition ${
                      selected 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : 'bg-slate-900 border-slate-800 text-gray-400 hover:border-slate-700'
                    }`}
                  >
                    {selected && <Check size={12} />}
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300">Custom System Instruction Prompt</label>
            <textarea
              placeholder="e.g. You are a PhD Chemistry professor. Generate detailed questions with step-by-step molecular formulas..."
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-24 font-mono-custom text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-4 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-300">LLM Temperature:</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-24 accent-indigo-500"
              />
              <span className="text-xs font-mono-custom bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-indigo-400">{temperature}</span>
            </div>

            <button
              type="submit"
              className="ml-auto px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition shadow-md cursor-pointer glow-accent-blue"
            >
              Configure and Save
            </button>
          </div>
        </form>
      )}

      {/* Projects list */}
      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-panel rounded-xl p-10 text-center text-gray-400 max-w-xl mx-auto space-y-4">
          <Folder size={48} className="mx-auto text-indigo-400/60" />
          <h3 className="text-lg font-bold text-white">No active workspaces</h3>
          <p className="text-sm">Get started by creating your first dataset project. This will host all your raw sources, chunks, and generated instruction SFT pairs.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {projects.map(p => {
            const isActive = activeProjectId === p.id;
            const langs: string[] = JSON.parse(p.languages);
            const categoryLabel = categories.find(c => c.value === p.category)?.label || p.category;

            return (
              <div
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className={`glass-panel rounded-xl p-5 flex flex-col justify-between cursor-pointer border transition-all ${
                  isActive 
                    ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500/30' 
                    : 'hover:border-slate-700 hover:bg-slate-900/40 border-slate-800/80'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-gray-400'}`}>
                        <Cpu size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white m-0 flex items-center gap-2">
                          {p.name}
                          {isActive && (
                            <span className="text-[10px] bg-emerald-500/20 border border-emerald-500 text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </h3>
                        <span className="text-[10px] text-gray-500 font-mono-custom">{p.id.substring(0, 8)}...</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={e => handleDelete(p.id, e)}
                      className="text-gray-500 hover:text-red-400 transition p-1.5 rounded hover:bg-slate-900"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <p className="text-sm text-gray-400 line-clamp-2 h-10">{p.description || 'No description provided.'}</p>
                </div>

                <div className="border-t border-slate-900 mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-gray-500">
                    Category: <span className="font-semibold text-slate-300">{categoryLabel}</span>
                  </div>

                  <div className="flex items-center gap-1 text-indigo-400">
                    <Languages size={14} />
                    <span>{langs.join(', ')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
