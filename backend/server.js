const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static folder for assets (optional, React serves assets directly, but backend can expose static tmp outputs)
app.use('/tmp', express.static('/tmp'));

// Import Routes
const chatRouter = require('./routes/chat.js');
const voiceRouter = require('./routes/voice.js');
const systemRouter = require('./routes/system.js');

app.use('/api/chat', chatRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/system', systemRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Express Backend Server running on http://localhost:${PORT}`);
});
