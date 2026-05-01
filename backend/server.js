const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// 1. Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// 2. Import Routes
const contactRoutes = require('./routes/contacts');
const newsletterRoutes = require('./routes/newsletter');
const portfolioRoutes = require('./routes/portfolio');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');

// 3. Use Routes
app.use('/api/contacts', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// 4. Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server Live', database: 'PostgreSQL/Supabase' });
});

// 5. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});