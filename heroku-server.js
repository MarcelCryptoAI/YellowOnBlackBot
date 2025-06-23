const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// API proxy to Python backend (if needed)
app.use('/api', (req, res) => {
  // Proxy to Python backend running on different port
  // For now, redirect API calls to the same domain
  res.status(404).json({ error: 'API endpoint not found. Backend should be running separately.' });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Python backend as child process (if in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('🐍 Starting Python backend...');
  const pythonProcess = spawn('python', ['backend_new/live_main.py'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python backend:', err);
  });
}

app.listen(PORT, () => {
  console.log(`🚀 CTB Trading Frontend running on port ${PORT}`);
  console.log(`📱 Access at: http://localhost:${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('🔴 Production mode - Backend should be running separately');
  }
});