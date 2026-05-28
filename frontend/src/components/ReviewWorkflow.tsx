import React, { useEffect, useState } from 'react';
import { Check, X, Edit3, ShieldAlert, Award, Filter, Languages, FolderSync, ChevronRight, Save } from 'lucide-react';

interface Sample {
  id: string;
  project_id: string;
  source_id: string;
  chunk_id: string;
  category: string;
  instruction: string;
  response: string;
  reasoning: string;
  preference_chosen: string;
  preference_rejected: string;
  language: string;
  quality_score: number;
  quality_metrics: string; // JSON string
  duplicate_status: string;
  duplicate_of: string;
  contamination_status: string;
  contamination_details: string;
  review_status: string;
  created_at: string;
}

interface ReviewWorkflowProps {
  projectId: string | null;
}

export default function ReviewWorkflow({ projectId }: ReviewWorkflowProps) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filterStatus, setFilterStatus] = useState('pending_review');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterDuplicate, setFilterDuplicate] = useState('');
  const [filterContamination, setFilterContamination] = useState('');

  // Bulk actions selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Editing state
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [editResponse, setEditResponse] = useState('');
  const [editReasoning, setEditReasoning] = useState('');
  const [editChosen, setEditChosen] = useState('');
  const [editRejected, setEditRejected] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchSamples();
    }
  }, [projectId, filterStatus, filterCategory, filterMinScore, filterDuplicate, filterContamination]);

  const fetchSamples = async () => {
    if (!projectId) return;
    setLoading(true);

    let url = `http://localhost:5001/api/projects/${projectId}/samples?reviewStatus=${filterStatus}`;
    if (filterCategory) url += `&category=${filterCategory}`;
    if (filterMinScore > 0) url += `&minScore=${filterMinScore}`;
    if (filterDuplicate) url += `&duplicateStatus=${filterDuplicate}`;
    if (filterContamination) url += `&contaminationStatus=${filterContamination}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      setSamples(data);
      setSelectedIds([]); // Clear selection on reload
    } catch (err) {
      console.error('Error fetching samples:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`http://localhost:5001/api/samples/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        setSamples(samples.filter(s => s.id !== id));
        setSelectedIds(selectedIds.filter(item => item !== id));
      }
    } catch (err) {
      console.error('Error updating review action:', err);
    }
  };

  const handleBulkAction = async (action: 'approved' | 'rejected') => {
    if (selectedIds.length === 0) return;

    try {
      const res = await fetch(`http://localhost:5001/api/projects/${projectId}/review/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sampleIds: selectedIds
        })
      });

      if (res.ok) {
        setSamples(samples.filter(s => !selectedIds.includes(s.id)));
        setSelectedIds([]);
      }
    } catch (err) {
      console.error('Error running bulk action:', err);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(samples.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const startEdit = (sample: Sample) => {
    setEditingSample(sample);
    setEditInstruction(sample.instruction);
    setEditResponse(sample.response);
    setEditReasoning(sample.reasoning || '');
    setEditChosen(sample.preference_chosen || '');
    setEditRejected(sample.preference_rejected || '');
  };

  const saveEdit = async () => {
    if (!editingSample) return;

    try {
      const res = await fetch(`http://localhost:5001/api/samples/${editingSample.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: editInstruction,
          response: editResponse,
          reasoning: editReasoning || null,
          preference_chosen: editChosen || null,
          preference_rejected: editRejected || null,
          review_status: 'pending_review' // Keep in pending for review
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSamples(samples.map(s => s.id === updated.id ? updated : s));
        setEditingSample(null);
      }
    } catch (err) {
      console.error('Error saving edited sample:', err);
    }
  };

  if (!projectId) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-gray-400">
        Please select or configure a project workspace first.
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    sft: 'SFT QA',
    reasoning: 'Reasoning (CoT)',
    coding: 'Coding SFT',
    tool_use: 'Tool Use',
    preference: 'Preference'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white m-0">Human Review Console</h1>
        <p className="text-gray-400 mt-1">Audit synthetic instructions, edit outputs, de-duplicate flags, check benchmark contamination, and release.</p>
      </div>

      {/* Filters Hub */}
      <div className="glass-panel rounded-xl p-5 grid grid-cols-2 gap-4 md:grid-cols-5 text-xs">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase">Review Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
          >
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="generated">Generated</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase">Category</label>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="sft">SFT QA</option>
            <option value="reasoning">Reasoning (CoT)</option>
            <option value="coding">Coding SFT</option>
            <option value="tool_use">Tool Use</option>
            <option value="preference">Preference</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase">Quality Score</label>
          <select
            value={filterMinScore}
            onChange={e => setFilterMinScore(parseInt(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
          >
            <option value="0">All Scores</option>
            <option value="70">≥ 70% Quality</option>
            <option value="80">≥ 80% Quality</option>
            <option value="90">≥ 90% Quality</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase">De-duplication</label>
          <select
            value={filterDuplicate}
            onChange={e => setFilterDuplicate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
          >
            <option value="">All</option>
            <option value="clean">Clean Only</option>
            <option value="duplicate">Duplicates Only</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase">Contamination</label>
          <select
            value={filterContamination}
            onChange={e => setFilterContamination(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
          >
            <option value="">All</option>
            <option value="clean">Clean Only</option>
            <option value="contaminated">Contaminated Only</option>
          </select>
        </div>
      </div>

      {/* Bulk actions and counts banner */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-5 py-3 text-xs animate-fade-in">
          <div className="text-indigo-300 font-semibold flex items-center gap-2">
            <FolderSync size={16} />
            {selectedIds.length} SFT sample(s) selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleBulkAction('approved')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition px-4 py-2 font-semibold text-white cursor-pointer"
            >
              <Check size={14} />
              Bulk Approve
            </button>
            <button
              onClick={() => handleBulkAction('rejected')}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition px-4 py-2 font-semibold text-white cursor-pointer"
            >
              <X size={14} />
              Bulk Reject
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal (conditional rendering) */}
      {editingSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-xl p-6 w-full max-w-3xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl">
            <h2 className="text-lg font-bold text-white m-0 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Edit3 size={18} className="text-indigo-400" />
              Edit SFT Sample details
            </h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Instruction Prompt</label>
                <textarea
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-24 focus:outline-none"
                />
              </div>

              {/* Conditional rendering based on category */}
              {editingSample.category === 'preference' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-emerald-400">Chosen Response (Superior)</label>
                    <textarea
                      value={editChosen}
                      onChange={e => setEditChosen(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-950 rounded-lg px-3 py-2 text-sm text-white h-32 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-red-400">Rejected Response (Inferior)</label>
                    <textarea
                      value={editRejected}
                      onChange={e => setEditRejected(e.target.value)}
                      className="w-full bg-slate-900 border border-red-950 rounded-lg px-3 py-2 text-sm text-white h-32 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300">Model Response Output</label>
                    <textarea
                      value={editResponse}
                      onChange={e => setEditResponse(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-36 focus:outline-none"
                    />
                  </div>
                  
                  {editingSample.category === 'reasoning' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-indigo-400">Reasoning Trace (CoT)</label>
                      <textarea
                        value={editReasoning}
                        onChange={e => setEditReasoning(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-24 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setEditingSample(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-md cursor-pointer glow-accent-blue"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Review table / list view */}
      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : samples.length === 0 ? (
        <div className="glass-panel rounded-xl p-10 text-center text-gray-400 max-w-xl mx-auto">
          No datasets match selected filter scopes. Click Run Generation to generate SFT samples or adjust review filters.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass-panel rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/30 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={samples.length > 0 && selectedIds.length === samples.length}
                      className="accent-indigo-600 rounded"
                    />
                  </th>
                  <th className="py-3 px-4">Instruction Prompt</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Lang</th>
                  <th className="py-3 px-4">Quality Score</th>
                  <th className="py-3 px-4">Checks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-950 text-xs text-gray-300">
                {samples.map(s => {
                  const metrics = s.quality_metrics ? JSON.parse(s.quality_metrics) : null;
                  const isDup = s.duplicate_status === 'duplicate';
                  const isContam = s.contamination_status === 'contaminated';

                  return (
                    <tr key={s.id} className={`hover:bg-slate-900/10 ${selectedIds.includes(s.id) ? 'bg-indigo-950/10' : ''}`}>
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => handleSelectRow(s.id)}
                          className="accent-indigo-600 rounded"
                        />
                      </td>
                      
                      <td className="py-4 px-4 max-w-xs md:max-w-md">
                        <p className="font-semibold text-white truncate">{s.instruction}</p>
                        <p className="text-gray-500 truncate mt-0.5">{s.response || s.preference_chosen || 'No response details'}</p>
                      </td>

                      <td className="py-4 px-4">
                        <span className="bg-slate-900 border border-slate-800 text-gray-300 px-2 py-0.5 rounded text-[10px] font-medium">
                          {categoryLabels[s.category] || s.category}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-gray-400 font-medium">
                        {s.language}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full ${s.quality_score >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          <span className="font-bold text-white font-mono-custom">{s.quality_score}%</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex gap-1.5">
                          {isDup && (
                            <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-amber-500/15" title="Semantic duplicate detected">
                              Dup
                            </span>
                          )}
                          {isContam && (
                            <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-red-500/15" title={s.contamination_details || 'Contaminated'}>
                              Leak
                            </span>
                          )}
                          {!isDup && !isContam && (
                            <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-emerald-500/15">
                              Pass
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(s)}
                            className="text-gray-400 hover:text-indigo-400 transition p-1 rounded hover:bg-slate-900"
                            title="Edit Sample"
                          >
                            <Edit3 size={14} />
                          </button>
                          
                          {filterStatus === 'pending_review' && (
                            <>
                              <button
                                onClick={() => handleReviewAction(s.id, 'approved')}
                                className="text-emerald-500 hover:text-emerald-400 transition p-1 rounded hover:bg-slate-900 border border-emerald-500/20"
                                title="Approve"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleReviewAction(s.id, 'rejected')}
                                className="text-red-500 hover:text-red-400 transition p-1 rounded hover:bg-slate-900 border border-red-500/20"
                                title="Reject"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
