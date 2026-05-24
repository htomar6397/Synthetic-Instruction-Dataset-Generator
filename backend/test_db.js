const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_FILE);

const query = `INSERT INTO samples (
  id, project_id, source_id, chunk_id, category, instruction, response, reasoning, 
  language, quality_score, quality_metrics, review_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const params = [
  'test-id-12345',
  'test-project-id',
  'test-source-id',
  'test-chunk-id',
  'sft',
  'instruction test',
  'response test',
  null,
  'Hindi',
  80,
  '{}',
  'pending_review'
];

db.run(query, params, function(err) {
  if (err) {
    console.error("Error running query:", err);
  } else {
    console.log("Success! Inserted row:", this.lastID);
    // clean up
    db.run("DELETE FROM samples WHERE id = 'test-id-12345'", function(cleanErr) {
      if (cleanErr) console.error("Clean error:", cleanErr);
      else console.log("Cleaned up successfully!");
    });
  }
  setTimeout(() => db.close(), 1000);
});
