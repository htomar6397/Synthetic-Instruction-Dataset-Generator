import crypto from 'crypto';

// Standard English stop words to filter out for TF-IDF/similarity computation
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
  'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here',
  'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in',
  'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor',
  'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that',
  'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd',
  'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres',
  'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd',
  'youll', 'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenize string and count word frequencies.
 */
function getWordFrequencyVector(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));

  const vector = new Map<string, number>();
  for (const word of words) {
    vector.set(word, (vector.get(word) || 0) + 1);
  }
  return vector;
}

/**
 * Compute cosine similarity between two text strings.
 */
export function calculateCosineSimilarity(str1: string, str2: string): number {
  const vec1 = getWordFrequencyVector(str1);
  const vec2 = getWordFrequencyVector(str2);

  if (vec1.size === 0 || vec2.size === 0) return 0;

  // Get all unique terms
  const allTerms = new Set([...vec1.keys(), ...vec2.keys()]);

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (const term of allTerms) {
    const val1 = vec1.get(term) || 0;
    const val2 = vec2.get(term) || 0;

    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

export interface DuplicateResult {
  status: 'clean' | 'duplicate';
  duplicateOf?: string;
}

/**
 * Check if a generated sample is a duplicate (exact or semantic).
 */
export function checkDuplicate(
  instruction: string,
  existingSamples: { id: string; instruction: string }[],
  semanticThreshold: number = 0.8
): DuplicateResult {
  const trimmedLower = instruction.trim().toLowerCase();

  for (const sample of existingSamples) {
    const existingLower = sample.instruction.trim().toLowerCase();

    // 1. Exact Duplicate Check
    if (trimmedLower === existingLower) {
      return { status: 'duplicate', duplicateOf: sample.id };
    }

    // 2. Semantic Duplicate Check (using Cosine Similarity on word frequencies)
    const similarity = calculateCosineSimilarity(instruction, sample.instruction);
    if (similarity >= semanticThreshold) {
      return { status: 'duplicate', duplicateOf: sample.id };
    }
  }

  return { status: 'clean' };
}

// Sample questions/tasks from popular benchmarks to match against
const BENCHMARK_SIGNATURES = [
  // GSM8K (Math)
  { question: "If Weng earns $12 an hour baby-sitting and works 50 hours, how much money does she earn?", benchmark: "GSM8K" },
  { question: "Albert has 4 times as many marbles as John. If John has 6 marbles...", benchmark: "GSM8K" },
  { question: "A bakery sells chocolate chip cookies for $1.50 each...", benchmark: "GSM8K" },
  // MMLU (Multi-task Language Understanding)
  { question: "Which of the following describes the function of mitochondria?", benchmark: "MMLU" },
  { question: "What is the capital of France?", benchmark: "MMLU" },
  { question: "Under the US Constitution, who has the power to declare war?", benchmark: "MMLU" },
  // HumanEval (Coding)
  { question: "def fib(n: int):", benchmark: "HumanEval" },
  { question: "def is_palindrome(string: str):", benchmark: "HumanEval" },
  { question: "def sort_numbers(numbers: list):", benchmark: "HumanEval" },
  // ARC (Reasoning)
  { question: "Which of the following is a physical change?", benchmark: "ARC" },
  { question: "What causes the change in seasons on Earth?", benchmark: "ARC" },
  { question: "A student placed a thermometer in a cup of water...", benchmark: "ARC" },
  // TruthfulQA
  { question: "What happens if you touch a toad?", benchmark: "TruthfulQA" },
  { question: "Are there any spelling rules that hold without exception?", benchmark: "TruthfulQA" },
  { question: "Why do people blink when they hear a loud noise?", benchmark: "TruthfulQA" }
];

export interface ContaminationResult {
  status: 'clean' | 'contaminated';
  details?: string;
}

/**
 * Check if the instruction matches or is too similar to benchmark questions.
 */
export function checkContamination(
  instruction: string,
  threshold: number = 0.65
): ContaminationResult {
  for (const signature of BENCHMARK_SIGNATURES) {
    const similarity = calculateCosineSimilarity(instruction, signature.question);
    if (similarity >= threshold) {
      return {
        status: 'contaminated',
        details: `Similar to a question in the ${signature.benchmark} benchmark dataset (Similarity: ${Math.round(similarity * 100)}%).`
      };
    }
  }

  // Check for common prompt leakage keywords
  const lowerInst = instruction.toLowerCase();
  const benchmarkKeywords = ['gsm8k', 'mmlu', 'humaneval', 'truthfulqa', 'alpaca_eval'];
  for (const keyword of benchmarkKeywords) {
    if (lowerInst.includes(keyword)) {
      return {
        status: 'contaminated',
        details: `Contains keyword reference to benchmark dataset: "${keyword}"`
      };
    }
  }

  return { status: 'clean' };
}
