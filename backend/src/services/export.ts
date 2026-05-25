export interface ExportSample {
  category: string;
  instruction: string;
  response: string;
  reasoning?: string;
  preference_chosen?: string;
  preference_rejected?: string;
  language: string;
  quality_score: number;
}

/**
 * Format samples into a single JSON string.
 */
export function exportToJson(samples: ExportSample[]): string {
  const formatted = samples.map(s => {
    const base: any = {
      instruction: s.instruction,
      response: s.response,
      category: s.category,
      language: s.language,
      quality_score: s.quality_score
    };
    if (s.reasoning) base.reasoning = s.reasoning;
    if (s.preference_chosen) base.chosen = s.preference_chosen;
    if (s.preference_rejected) base.rejected = s.preference_rejected;
    return base;
  });
  return JSON.stringify(formatted, null, 2);
}

/**
 * Format samples into a JSON Lines (JSONL) string.
 */
export function exportToJsonl(samples: ExportSample[]): string {
  return samples
    .map(s => {
      const base: any = {
        instruction: s.instruction,
        response: s.response,
        category: s.category,
        language: s.language,
        quality_score: s.quality_score
      };
      if (s.reasoning) base.reasoning = s.reasoning;
      if (s.preference_chosen) base.chosen = s.preference_chosen;
      if (s.preference_rejected) base.rejected = s.preference_rejected;
      return JSON.stringify(base);
    })
    .join('\n');
}

/**
 * Format samples into a CSV string.
 */
export function exportToCsv(samples: ExportSample[]): string {
  const headers = ['instruction', 'response', 'reasoning', 'chosen', 'rejected', 'category', 'language', 'quality_score'];
  const csvRows = [headers.join(',')];

  for (const s of samples) {
    const values = [
      s.instruction,
      s.response,
      s.reasoning || '',
      s.preference_chosen || '',
      s.preference_rejected || '',
      s.category,
      s.language,
      String(s.quality_score)
    ];

    // Escape double quotes and wrap in quotes if contains commas/newlines
    const escaped = values.map(val => {
      const cleaned = val.replace(/"/g, '""');
      if (cleaned.includes(',') || cleaned.includes('\n') || cleaned.includes('"')) {
        return `"${cleaned}"`;
      }
      return cleaned;
    });

    csvRows.push(escaped.join(','));
  }

  return csvRows.join('\n');
}

export interface HuggingFacePushParams {
  repoId: string;
  token: string;
  datasetName: string;
  split: string; // train, test, validation
  samples: ExportSample[];
}

/**
 * Mock pushing a dataset to the Hugging Face Hub (simulating API calls).
 */
export async function pushToHuggingFace(params: HuggingFacePushParams): Promise<{ success: boolean; url: string }> {
  console.log(`Preparing export of ${params.samples.length} samples for Hugging Face repo: ${params.repoId}...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2500));

  if (!params.token || params.token.trim() === '') {
    throw new Error('Hugging Face API Write Token is required.');
  }

  if (!params.repoId || !params.repoId.includes('/')) {
    throw new Error('Invalid repository ID. Must be in username/dataset-name format.');
  }

  return {
    success: true,
    url: `https://huggingface.co/datasets/${params.repoId}`
  };
}
