const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PLANNER_PORT || 4000;
const COMMENTS_FILE = path.join(__dirname, 'comments.json');
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(__dirname));

function readComments() {
  try { return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8')); }
  catch { return {}; }
}
function writeComments(data) {
  const tempFile = `${COMMENTS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, COMMENTS_FILE);
}

app.get('/api/comments', (req, res) => {
  res.json(readComments());
});

app.post('/api/comments', (req, res) => {
  const { featureId, author, text } = req.body || {};
  const normalizedFeatureId = typeof featureId === 'string' ? featureId.trim() : '';
  const normalizedAuthor = typeof author === 'string' ? author.trim().slice(0, 60) : 'Anonymous';
  const normalizedText = typeof text === 'string' ? text.trim() : '';

  if (!normalizedFeatureId || !normalizedText) {
    return res.status(400).json({ error: 'featureId and text required' });
  }
  if (normalizedFeatureId.length > 80 || normalizedText.length > 2000) {
    return res.status(400).json({ error: 'Comment payload exceeds allowed length' });
  }

  const comments = readComments();
  if (!comments[normalizedFeatureId]) comments[normalizedFeatureId] = [];
  comments[normalizedFeatureId].push({
    author: normalizedAuthor || 'Anonymous',
    text: normalizedText,
    time: Date.now()
  });
  writeComments(comments);
  res.json({ ok: true });
});

app.delete('/api/comments', (req, res) => {
  const { featureId, index } = req.body || {};
  const normalizedFeatureId = typeof featureId === 'string' ? featureId.trim() : '';
  const normalizedIndex = Number.isInteger(index) ? index : Number.parseInt(index, 10);
  if (!normalizedFeatureId || Number.isNaN(normalizedIndex) || normalizedIndex < 0) {
    return res.status(400).json({ error: 'featureId and numeric index required' });
  }
  const comments = readComments();
  if (comments[normalizedFeatureId] && comments[normalizedFeatureId][normalizedIndex] !== undefined) {
    comments[normalizedFeatureId].splice(normalizedIndex, 1);
    if (comments[normalizedFeatureId].length === 0) delete comments[normalizedFeatureId];
    writeComments(comments);
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Planner running at http://localhost:${PORT}`);
});
