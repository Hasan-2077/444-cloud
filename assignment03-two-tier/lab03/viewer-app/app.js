const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const BUCKET = process.env.BUCKET_NAME;
const PORT = process.env.PORT || 3000;
const s3 = new S3Client({ region: process.env.AWS_REGION });

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

app.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: 'shared.txt'
    }));

    const text = await result.Body.transformToString('utf-8');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="utf-8"><title>Viewer</title></head>
      <body>
        <h1>Viewer</h1>
        <h2>Contents of shared.txt</h2>
        <pre style="white-space: pre-wrap;">${escapeHtml(text)}</pre>
        <a href="/">Refresh</a>
      </body>
      </html>
    `);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).send(
        '<h1>Viewer</h1><p>No file uploaded yet.</p><a href="/">Refresh</a>'
      );
    }

    console.error('S3 read failed:', error);
    res.status(500).send(
      '<h1>Viewer</h1><p>Unable to read the file from S3.</p><a href="/">Retry</a>'
    );
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Viewer listening on ${PORT}`);
});
