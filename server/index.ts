import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (manual implementation)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Serve static files from the client build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist/public')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/public/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
