import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 6789;

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'dist')));

// API proxy setup (for when we have backend)
app.use('/api/*', (req, res) => {
  res.status(503).json({ 
    success: false, 
    message: 'Backend service temporarily unavailable. Please configure your API endpoints.' 
  });
});

// Catch-all handler: send back React's index.html file for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ARIE AI Trading System running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || `http://localhost:${PORT}`}`);
});