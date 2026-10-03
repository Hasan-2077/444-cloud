const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const BUCKET = process.env.BUCKET_NAME;
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE = 1048576;

const s3 = new S3Client({ region: process.env.AWS_REGION });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const isTxt =
      file.mimetype === 'text/plain' &&
      file.originalname.toLowerCase().endsWith('.txt');

    if (!isTxt) {
      return cb(new Error('ONLY_TXT_ALLOWED'));
    }
    cb(null, true);
  }
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Uploader</title></head>
    <body>
      <h1>Uploader - Version 2</h1>
      <form method="POST" action="/upload" enctype="multipart/form-data">
        <input type="file" name="txtfile" accept=".txt" required>
        <p>Only .txt files, max 1MB</p>
        <button type="submit">Upload</button>
      </form>
    </body>
    </html>
  `);
});

app.post('/upload', (req, res) => {
  upload.single('txtfile')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).send(
          '<p>Upload failed: file exceeds the 1MB limit.</p><a href="/">Try again</a>'
        );
      }

      if (err.message === 'ONLY_TXT_ALLOWED') {
        return res.status(415).send(
          '<p>Upload failed: only .txt files are allowed.</p><a href="/">Try again</a>'
        );
      }

      return res.status(400).send(
        '<p>Upload failed: invalid upload request.</p><a href="/">Try again</a>'
      );
    }

    if (!req.file) {
      return res.status(400).send('No file selected.');
    }

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: 'shared.txt',
        Body: req.file.buffer,
        ContentType: 'text/plain'
      }));

      res.send(
        '<p>Upload successful.</p><a href="/">Upload another</a>'
      );
    } catch (error) {
      console.error('S3 upload failed:', error);
      res.status(500).send(
        '<p>Upload failed: unable to save the file to S3.</p><a href="/">Try again</a>'
      );
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Uploader listening on ${PORT}`);
});
