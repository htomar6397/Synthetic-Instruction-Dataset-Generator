import { run, initDb } from './db';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  await initDb();
  const query = `INSERT INTO samples (
    id, project_id, source_id, chunk_id, category, instruction, response, reasoning, 
    language, quality_score, quality_metrics, review_status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    uuidv4(),
    'test-project-id',
    'test-source-id',
    'test-chunk-id',
    'sft',
    'instruction test ts',
    'response test ts',
    null,
    'Hindi',
    80,
    '{}',
    'pending_review'
  ];

  try {
    const result = await run(query, params);
    console.log("TS Success! Inserted:", result);
  } catch (err) {
    console.error("TS Error:", err);
  }
}

test();
