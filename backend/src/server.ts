import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import {
  initDb,
  run,
  get,
  all
} from './db';
import {
  chunkText,
  scrapeUrl,
  extractPdfText
} from './services/ingest';
import {
  generateSamples,
  translateSample,
  evaluateSampleQuality,
  isLlmActive
} from './services/llm';
import {
  checkDuplicate,
  checkContamination
} from './services/quality';
import {
  exportToJson,
  exportToJsonl,
  exportToCsv,
  pushToHuggingFace,
  ExportSample
} from './services/export';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Setup Multer for in-memory file uploads
const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// --- API ROUTES ---

/**
 * GET Global Dashboard Stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const totalProjects = await get<{ count: number }>('SELECT COUNT(*) as count FROM projects');
    const totalSources = await get<{ count: number }>('SELECT COUNT(*) as count FROM sources');
    const totalChunks = await get<{ count: number }>('SELECT COUNT(*) as count FROM chunks');
    
    const totalSamples = await get<{ count: number }>('SELECT COUNT(*) as count FROM samples');
    const approvedSamples = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE review_status = 'approved'");
    const rejectedSamples = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE review_status = 'rejected'");
    const pendingSamples = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE review_status = 'pending_review'");
    
    const duplicateCount = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE duplicate_status = 'duplicate'");
    const contaminationCount = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE contamination_status = 'contaminated'");

    const avgQualityScore = await get<{ avg: number }>('SELECT AVG(quality_score) as avg FROM samples');

    // Language distribution
    const langDistribution = await all<{ language: string; count: number }>(
      'SELECT language, COUNT(*) as count FROM samples GROUP BY language'
    );

    // Generation over time (mocked based on creation timestamps grouped by day)
    const genHistory = await all<{ date: string; count: number }>(
      `SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count 
       FROM samples 
       GROUP BY date 
       ORDER BY date DESC LIMIT 7`
    );

    res.json({
      projects: totalProjects?.count || 0,
      sources: totalSources?.count || 0,
      chunks: totalChunks?.count || 0,
      samples: {
        total: totalSamples?.count || 0,
        approved: approvedSamples?.count || 0,
        rejected: rejectedSamples?.count || 0,
        pending: pendingSamples?.count || 0,
        duplicates: duplicateCount?.count || 0,
        contaminated: contaminationCount?.count || 0,
      },
      averageQualityScore: Math.round(avgQualityScore?.avg || 0),
      languages: langDistribution,
      generationHistory: genHistory.reverse(),
      llmActive: await isLlmActive()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Projects Endpoints
 */
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await all('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name, description, category, languages, systemPrompt, config } = req.body;
  if (!name || !category || !languages) {
    return res.status(400).json({ error: 'Missing name, category, or languages.' });
  }

  const id = uuidv4();
  const languagesStr = JSON.stringify(languages);
  const configStr = JSON.stringify(config || {});

  try {
    await run(
      `INSERT INTO projects (id, name, description, category, languages, system_prompt, config) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, category, languagesStr, systemPrompt || '', configStr]
    );
    const newProject = await get('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(newProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    await run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET stats specific to a project
 */
app.get('/api/projects/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const totalSamples = await get<{ count: number }>('SELECT COUNT(*) as count FROM samples WHERE project_id = ?', [id]);
    const approvedSamples = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE project_id = ? AND review_status = 'approved'", [id]);
    const rejectedSamples = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE project_id = ? AND review_status = 'rejected'", [id]);
    const duplicateCount = await get<{ count: number }>("SELECT COUNT(*) as count FROM samples WHERE project_id = ? AND duplicate_status = 'duplicate'", [id]);
    const avgScore = await get<{ avg: number }>('SELECT AVG(quality_score) as avg FROM samples WHERE project_id = ?', [id]);

    res.json({
      totalSamples: totalSamples?.count || 0,
      approved: approvedSamples?.count || 0,
      rejected: rejectedSamples?.count || 0,
      duplicates: duplicateCount?.count || 0,
      avgQuality: Math.round(avgScore?.avg || 0)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sources Endpoints (Ingestion)
 */
app.get('/api/projects/:id/sources', async (req, res) => {
  try {
    const sources = await all('SELECT * FROM sources WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(sources);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/sources', upload.single('file'), async (req, res) => {
  const { id: projectId } = req.params;
  const { name, type, url, rawText, chunkSize, chunkOverlap } = req.body;

  const cSize = parseInt(chunkSize || '500');
  const cOverlap = parseInt(chunkOverlap || '50');

  let content = '';
  let sourceName = name || 'Raw Text Upload';

  try {
    // 1. Ingest content based on type
    if (type === 'website') {
      if (!url) return res.status(400).json({ error: 'URL is required for website scraping.' });
      content = await scrapeUrl(url);
      sourceName = name || url;
    } else if (type === 'pdf') {
      if (!req.file) return res.status(400).json({ error: 'PDF file upload is required.' });
      content = await extractPdfText(req.file.buffer);
      sourceName = name || req.file.originalname;
    } else if (type === 'file') {
      // standard plain text upload
      if (req.file) {
        content = req.file.buffer.toString('utf-8');
        sourceName = name || req.file.originalname;
      } else if (rawText) {
        content = rawText;
      } else {
        return res.status(400).json({ error: 'Raw text or file upload is required.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid source type.' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Failed to extract text content.' });
    }

    // 2. Insert Source into DB
    const sourceId = uuidv4();
    await run(
      'INSERT INTO sources (id, project_id, name, type, content) VALUES (?, ?, ?, ?, ?)',
      [sourceId, projectId, sourceName, type, content]
    );

    // 3. Chunk source content and insert into chunks table
    const chunks = chunkText(content, { chunkSize: cSize, chunkOverlap: cOverlap });
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = uuidv4();
      await run(
        'INSERT INTO chunks (id, source_id, project_id, content, chunk_index) VALUES (?, ?, ?, ?, ?)',
        [chunkId, sourceId, projectId, chunks[i], i]
      );
    }

    res.status(201).json({
      success: true,
      sourceId,
      name: sourceName,
      chunksCount: chunks.length,
      characterCount: content.length
    });
  } catch (error: any) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sources/:id', async (req, res) => {
  try {
    const source = await get('SELECT * FROM sources WHERE id = ?', [req.params.id]);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }
    await run('DELETE FROM sources WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Source and its chunks deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id/chunks', async (req, res) => {
  try {
    const chunks = await all(
      `SELECT chunks.*, sources.name as source_name 
       FROM chunks 
       JOIN sources ON chunks.source_id = sources.id 
       WHERE chunks.project_id = ? 
       ORDER BY sources.name, chunks.chunk_index ASC`,
      [req.params.id]
    );
    res.json(chunks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generation Engine Endpoint
 */
app.post('/api/projects/:id/generate', async (req, res) => {
  const { id: projectId } = req.params;
  const { limit = 3, category } = req.body;

  try {
    const project = await get<{ id: string; category: string; languages: string; system_prompt: string }>(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const targetLanguages: string[] = JSON.parse(project.languages);
    const targetCategory = category || project.category;

    // Get chunks that haven't been used for generation yet (simplified check)
    // We select chunks for which no samples have been generated
    const chunks = await all<{ id: string; source_id: string; content: string }>(
      `SELECT chunks.id, chunks.source_id, chunks.content 
       FROM chunks 
       LEFT JOIN samples ON chunks.id = samples.chunk_id 
       WHERE chunks.project_id = ? AND samples.id IS NULL 
       LIMIT ?`,
      [projectId, parseInt(limit)]
    );

    if (chunks.length === 0) {
      return res.json({
        success: true,
        message: 'No unprocessed text chunks remaining. Ingest more sources first!',
        samplesGenerated: 0
      });
    }

    const generatedSamplesList = [];

    // Fetch existing samples in this project for duplication checking
    const existingSamples = await all<{ id: string; instruction: string }>(
      'SELECT id, instruction FROM samples WHERE project_id = ?',
      [projectId]
    );

    for (const chunk of chunks) {
      // Primary generation language is the first targeted language (defaults to English)
      const primaryLang = targetLanguages[0] || 'English';

      // 1. Generate primary samples from the chunk
      const rawSamples = await generateSamples(
        chunk.content,
        targetCategory,
        primaryLang,
        project.system_prompt
      );

      for (const rawSample of rawSamples) {
        // Run quality evaluations on the primary sample
        const qualityEval = await evaluateSampleQuality(
          chunk.content,
          rawSample.instruction,
          rawSample.response || ''
        );

        // Run duplicate and contamination checks
        const duplicateCheck = checkDuplicate(rawSample.instruction, existingSamples);
        const contaminationCheck = checkContamination(rawSample.instruction);

        // Define status
        const sampleId = uuidv4();
        const metricsStr = JSON.stringify({
          grammar: qualityEval.grammar,
          toxicity: qualityEval.toxicity,
          hallucination: qualityEval.hallucination,
          factual_consistency: qualityEval.factual_consistency,
          reasoning: qualityEval.reasoning
        });

        // Insert primary sample
        await run(
          `INSERT INTO samples (
            id, project_id, source_id, chunk_id, category, instruction, response, reasoning, 
            preference_chosen, preference_rejected, language, quality_score, quality_metrics, 
            duplicate_status, duplicate_of, contamination_status, contamination_details, review_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')`,
          [
            sampleId,
            projectId,
            chunk.source_id,
            chunk.id,
            targetCategory,
            rawSample.instruction,
            rawSample.response || '',
            rawSample.reasoning || null,
            rawSample.preference_chosen || null,
            rawSample.preference_rejected || null,
            primaryLang,
            qualityEval.score,
            metricsStr,
            duplicateCheck.status,
            duplicateCheck.duplicateOf || null,
            contaminationCheck.status,
            contaminationCheck.details || null
          ]
        );

        generatedSamplesList.push({
          id: sampleId,
          instruction: rawSample.instruction,
          response: rawSample.response || '',
          quality_score: qualityEval.score,
          duplicate: duplicateCheck.status === 'duplicate',
          contaminated: contaminationCheck.status === 'contaminated'
        });

        // Add to existing samples memory for sequential duplicate detection in same batch
        existingSamples.push({ id: sampleId, instruction: rawSample.instruction });

        // 2. Generate translations if multiple languages targetted
        for (let i = 1; i < targetLanguages.length; i++) {
          const transLang = targetLanguages[i];
          try {
            const translation = await translateSample(rawSample.instruction, rawSample.response || '', transLang);
            const tSampleId = uuidv4();

            await run(
              `INSERT INTO samples (
                id, project_id, source_id, chunk_id, category, instruction, response, reasoning, 
                language, quality_score, quality_metrics, review_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                tSampleId,
                projectId,
                chunk.source_id,
                chunk.id,
                targetCategory,
                translation.instruction,
                translation.response,
                rawSample.reasoning ? `[Translated to ${transLang}]: ${rawSample.reasoning}` : null,
                transLang,
                qualityEval.score, // Inherit quality score
                metricsStr,
                'pending_review'
              ]
            );
          } catch (tErr) {
            console.error(`Failed to generate translation for language ${transLang}:`, tErr);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully generated samples from ${chunks.length} chunks.`,
      samplesGenerated: generatedSamplesList.length,
      samples: generatedSamplesList
    });
  } catch (error: any) {
    console.error('Generation execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Samples and Review Endpoints
 */
app.get('/api/projects/:id/samples', async (req, res) => {
  const { id: projectId } = req.params;
  const { category, reviewStatus, minScore, duplicateStatus, contaminationStatus } = req.query;

  let query = 'SELECT * FROM samples WHERE project_id = ?';
  const params: any[] = [projectId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (reviewStatus) {
    query += ' AND review_status = ?';
    params.push(reviewStatus);
  }
  if (minScore) {
    query += ' AND quality_score >= ?';
    params.push(parseInt(minScore as string));
  }
  if (duplicateStatus) {
    query += ' AND duplicate_status = ?';
    params.push(duplicateStatus);
  }
  if (contaminationStatus) {
    query += ' AND contamination_status = ?';
    params.push(contaminationStatus);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const samples = await all(query, params);
    res.json(samples);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/samples/:id', async (req, res) => {
  const { id } = req.params;
  const { instruction, response, reasoning, preference_chosen, preference_rejected, review_status } = req.body;

  try {
    const sample = await get('SELECT * FROM samples WHERE id = ?', [id]);
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const finalStatus = review_status || 'edited';

    await run(
      `UPDATE samples 
       SET instruction = ?, response = ?, reasoning = ?, preference_chosen = ?, preference_rejected = ?, review_status = ? 
       WHERE id = ?`,
      [
        instruction ?? '',
        response ?? '',
        reasoning || null,
        preference_chosen || null,
        preference_rejected || null,
        finalStatus,
        id
      ]
    );

    const updatedSample = await get('SELECT * FROM samples WHERE id = ?', [id]);
    res.json(updatedSample);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/samples/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // approved, rejected, pending_review, archived

  if (!['approved', 'rejected', 'pending_review', 'archived'].includes(action)) {
    return res.status(400).json({ error: 'Invalid review action.' });
  }

  try {
    const sample = await get('SELECT * FROM samples WHERE id = ?', [id]);
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    await run('UPDATE samples SET review_status = ? WHERE id = ?', [action, id]);
    res.json({ success: true, id, status: action });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/review/bulk', async (req, res) => {
  const { id: projectId } = req.params;
  const { action, sampleIds } = req.body;

  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Invalid bulk action.' });
  }

  if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
    return res.status(400).json({ error: 'No sample IDs provided.' });
  }

  try {
    const placeholders = sampleIds.map(() => '?').join(',');
    await run(
      `UPDATE samples SET review_status = ? WHERE project_id = ? AND id IN (${placeholders})`,
      [action, projectId, ...sampleIds]
    );

    res.json({ success: true, count: sampleIds.length, status: action });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Dataset Versioning Endpoints
 */
app.get('/api/projects/:id/versions', async (req, res) => {
  try {
    const versions = await all('SELECT * FROM versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(versions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/versions', async (req, res) => {
  const { id: projectId } = req.params;
  const { versionString, changeLog } = req.body;

  if (!versionString) {
    return res.status(400).json({ error: 'Version string (e.g. 1.0.0) is required.' });
  }

  try {
    // Collect metrics for this release (only counting approved samples)
    const approvedSamples = await all<{ quality_score: number; language: string }>(
      "SELECT quality_score, language FROM samples WHERE project_id = ? AND review_status = 'approved'",
      [projectId]
    );

    if (approvedSamples.length === 0) {
      return res.status(400).json({ error: 'No approved samples found. Approve some samples before release!' });
    }

    const sampleCount = approvedSamples.length;
    const avgScore = approvedSamples.reduce((sum, s) => sum + s.quality_score, 0) / sampleCount;

    // Language counts
    const langCounts: Record<string, number> = {};
    for (const s of approvedSamples) {
      langCounts[s.language] = (langCounts[s.language] || 0) + 1;
    }

    const metrics = JSON.stringify({
      averageQuality: Math.round(avgScore),
      languages: langCounts,
      releasedAt: new Date().toISOString()
    });

    const id = uuidv4();
    await run(
      `INSERT INTO versions (id, project_id, version_string, sample_count, change_log, metrics) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, projectId, versionString, sampleCount, changeLog || '', metrics]
    );

    const newVersion = await get('SELECT * FROM versions WHERE id = ?', [id]);
    res.status(201).json(newVersion);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Dataset Export Endpoints
 */
app.get('/api/projects/:id/export', async (req, res) => {
  const { id: projectId } = req.params;
  const { format = 'json', scope = 'approved' } = req.query; // Scope: approved, all

  try {
    let query = 'SELECT * FROM samples WHERE project_id = ?';
    const queryParams: any[] = [projectId];

    if (scope === 'approved') {
      query += " AND review_status = 'approved'";
    } else {
      query += " AND review_status != 'rejected'"; // Exclude explicitly rejected samples
    }

    const samples = await all<any>(query, queryParams);

    if (samples.length === 0) {
      return res.status(404).json({ error: 'No data matches export parameters.' });
    }

    const exportData: ExportSample[] = samples.map((s: any) => ({
      category: s.category,
      instruction: s.instruction,
      response: s.response,
      reasoning: s.reasoning || undefined,
      preference_chosen: s.preference_chosen || undefined,
      preference_rejected: s.preference_rejected || undefined,
      language: s.language,
      quality_score: s.quality_score
    }));

    let fileContent = '';
    let contentType = 'application/json';
    let fileExtension = 'json';

    if (format === 'jsonl') {
      fileContent = exportToJsonl(exportData);
      contentType = 'application/x-jsonlines';
      fileExtension = 'jsonl';
    } else if (format === 'csv') {
      fileContent = exportToCsv(exportData);
      contentType = 'text/csv';
      fileExtension = 'csv';
    } else {
      fileContent = exportToJson(exportData);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="dataset_project_${projectId}.${fileExtension}"`);
    res.send(fileContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/export/hf', async (req, res) => {
  const { id: projectId } = req.params;
  const { repoId, token, datasetName, split = 'train' } = req.body;

  if (!repoId || !token) {
    return res.status(400).json({ error: 'Repository ID and Hugging Face write token are required.' });
  }

  try {
    const samples = await all<any>(
      "SELECT * FROM samples WHERE project_id = ? AND review_status = 'approved'",
      [projectId]
    );

    if (samples.length === 0) {
      return res.status(400).json({ error: 'No approved samples found to export.' });
    }

    const exportData: ExportSample[] = samples.map((s: any) => ({
      category: s.category,
      instruction: s.instruction,
      response: s.response,
      reasoning: s.reasoning || undefined,
      preference_chosen: s.preference_chosen || undefined,
      preference_rejected: s.preference_rejected || undefined,
      language: s.language,
      quality_score: s.quality_score
    }));

    const result = await pushToHuggingFace({
      repoId,
      token,
      datasetName: datasetName || `sidg_project_${projectId}`,
      split,
      samples: exportData
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SERVER LIFECYCLE ---

const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
};

startServer();
