require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true
}));

// Rate limiting. Disabled under NODE_ENV=test: the integration suite fires
// hundreds of requests from one IP in seconds, and the limiter answers 429 long
// before any test assertion can. Production behaviour is unchanged.
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // Raised for demo use: one active session (dashboard + navigation) fires
    // dozens of requests per minute, and a 429 in front of a client costs more
    // than the abuse it prevents on a LAN demo. Revisit before public hosting.
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    }
  });
  app.use('/api/', limiter);
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database initialization
require('./models/database');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api', require('./routes/modules'));
app.use('/api', require('./routes/finance'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/grades', require('./routes/grades'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/languages', require('./routes/languages'));
app.use('/api/levels', require('./routes/levels'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/students/:studentId/languages', require('./routes/studentLanguages'));
app.use('/api/placement-bands', require('./routes/placementBands'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND'
    }
  });
});

// Error handling middleware
app.use(require('./middleware/errorHandler'));

module.exports = app;
