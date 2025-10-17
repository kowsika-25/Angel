// backend/server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();


// Default route (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads folder if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 🧠 MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/file_uploads', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// 🧾 File Schema
const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  size: Number,
  path: String,
  uploadDate: { type: Date, default: Date.now },
});

const File = mongoose.model('File', fileSchema);

// ⚙️ Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// 🧭 ROUTES

// Get all files (combine DB & fs info)
app.get('/api/files', async (req, res) => {
  try {
    const files = await File.find().sort({ uploadDate: -1 });
    const fileList = files.map(file => {
      const filePath = path.join(__dirname, 'uploads', file.filename);
      let stats = null;
      if (fs.existsSync(filePath)) {
        stats = fs.statSync(filePath);
      }
      return {
        id: file._id,
        name: file.originalName,
        size: stats ? stats.size : file.size,
        uploaded: file.uploadDate,
        url: `/uploads/${file.filename}`,
      };
    });
    res.json(fileList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload files
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileDocs = await Promise.all(
      req.files.map(file => {
        const newFile = new File({
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          path: `/uploads/${file.filename}`,
        });
        return newFile.save();
      })
    );

    res.json({
      message: 'Files uploaded successfully',
      files: fileDocs.map(f => ({
        id: f._id,
        name: f.originalName,
        size: f.size,
        url: f.path,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete('/api/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(__dirname, 'uploads', file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await file.deleteOne();
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting file' });
  }
});

// Download file
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(__dirname, 'uploads', file.filename);
    res.download(filePath, file.originalName);
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
