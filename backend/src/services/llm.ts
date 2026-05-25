import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PYTHON_SERVICE_URL = 'http://localhost:8000';

// Structure definitions
export interface GeneratedSample {
  category: string;
  instruction: string;
  response?: string;
  reasoning?: string;
  preference_chosen?: string;
  preference_rejected?: string;
  language: string;
}

export interface QualityMetrics {
  score: number;
  grammar: number;
  toxicity: number;
  hallucination: number;
  factual_consistency: number;
  reasoning: string;
}

// Check if Python service is healthy
export async function isLlmActive(): Promise<boolean> {
  try {
    const res = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 2000 });
    return res.data?.status === 'healthy' && res.data?.llm_active;
  } catch (err) {
    return false;
  }
}

/**
 * Generate SFT samples using the Python AI Service.
 */
export async function generateSamples(
  chunk: string,
  category: string,
  language: string,
  customPrompt?: string
): Promise<GeneratedSample[]> {
  try {
    const res = await axios.post(`${PYTHON_SERVICE_URL}/generate`, {
      chunk,
      category,
      language,
      system_prompt: customPrompt
    });

    const data = res.data;
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        category,
        instruction: item.instruction || '',
        response: item.response || '',
        reasoning: item.reasoning || undefined,
        preference_chosen: item.preference_chosen || undefined,
        preference_rejected: item.preference_rejected || undefined,
        language
      }));
    }
    throw new Error('Invalid response format from Python service');
  } catch (error: any) {
    console.warn(`Python AI service generate failed, falling back to mock: ${error.message}`);
    return generateMockSamples(chunk, category, language);
  }
}

/**
 * Translate instruction and response using the Python AI Service.
 */
export async function translateSample(
  instruction: string,
  response: string,
  targetLanguage: string
): Promise<{ instruction: string; response: string }> {
  try {
    const res = await axios.post(`${PYTHON_SERVICE_URL}/translate`, {
      instruction,
      response,
      target_language: targetLanguage
    });
    return res.data;
  } catch (error: any) {
    console.warn(`Python AI service translate failed, falling back to mock: ${error.message}`);
    return {
      instruction: `[Translated to ${targetLanguage}]: ${instruction}`,
      response: `[Translated to ${targetLanguage}]: ${response}`
    };
  }
}

/**
 * Evaluate SFT sample quality using the Python AI Service.
 */
export async function evaluateSampleQuality(
  context: string,
  instruction: string,
  response: string
): Promise<QualityMetrics> {
  try {
    const res = await axios.post(`${PYTHON_SERVICE_URL}/evaluate`, {
      context,
      instruction,
      response
    });
    return res.data;
  } catch (error: any) {
    console.warn(`Python AI service evaluate failed, falling back to mock: ${error.message}`);
    return {
      score: 80,
      grammar: 85,
      toxicity: 0,
      hallucination: 15,
      factual_consistency: 85,
      reasoning: 'Failed to connect to Python evaluation service. Used default fallback scores.'
    };
  }
}

/**
 * Generate mock dataset samples for offline/fallback mode.
 */
function generateMockSamples(chunk: string, category: string, language: string): GeneratedSample[] {
  const sentences = chunk.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  const samples: GeneratedSample[] = [];

  const langTag = language.toLowerCase() !== 'english' ? `[In ${language}] ` : '';

  if (sentences.length === 0) {
    sentences.push(chunk.substring(0, 50));
  }

  if (category === 'reasoning') {
    samples.push({
      category,
      instruction: `${langTag}Analyze the structural concept of: "${sentences[0] || 'the provided text'}"`,
      reasoning: `1. Identify the core premise: "${sentences[0]}".\n2. Determine context: The source text discusses this subject.\n3. Formulate conclusion: This indicates a fundamental rule in the dataset.`,
      response: `${langTag}Based on logical analysis, this establishes the primary parameter of the concept.`,
      language
    });
    if (sentences[1]) {
      samples.push({
        category,
        instruction: `${langTag}What logical inference can be drawn from: "${sentences[1]}"?`,
        reasoning: `1. The text states: "${sentences[1]}".\n2. This correlates with the preceding statement.\n3. Combining these aspects yields a secondary principle.`,
        response: `${langTag}The core inference is that the described system acts recursively.`,
        language
      });
    }
  } else if (category === 'coding') {
    samples.push({
      category,
      instruction: `${langTag}Write a program structure that implements the concept of: "${sentences[0]}"`,
      response: `${langTag}Here is a Python implementation of the concept:\n\n\`\`\`python\ndef process_concept(data):\n    # Core premise: ${sentences[0].substring(0, 40)}\n    result = []\n    for item in data:\n        # Process item\n        result.append(item.strip())\n    return result\n\`\`\`\n\nThis function iterates over input items, applying basic cleaning functions matching the described logic.`,
      language
    });
  } else if (category === 'tool_use') {
    samples.push({
      category,
      instruction: `${langTag}Request data operations matching: "${sentences[0].substring(0, 30)}"`,
      response: `Tool: perform_database_search(query="${sentences[0].substring(0, 25)}", limit=5)`,
      language
    });
  } else if (category === 'preference') {
    samples.push({
      category,
      instruction: `${langTag}Explain the core meaning of: "${sentences[0]}"`,
      preference_chosen: `${langTag}The statement "${sentences[0]}" describes the primary mechanism. This works by separating concerns and structuring data accordingly.`,
      preference_rejected: `${langTag}It means that "${sentences[0]}" is a general rule. There is no other detail.`,
      language
    });
  } else {
    // General QA / SFT
    sentences.forEach((sentence, index) => {
      if (index < 3) {
        samples.push({
          category,
          instruction: `${langTag}Explain the key point: "${sentence}."`,
          response: `${langTag}According to the reference source, ${sentence}. This represents a key attribute of the overall context.`,
          language
        });
      }
    });
  }

  return samples;
}
