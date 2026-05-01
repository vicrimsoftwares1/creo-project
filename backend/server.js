// ============================================
// C REO AGENCY - BACKEND API
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// ============================================
// DATABASE CONNECTION
// ============================================
const { Sequelize, DataTypes } = require('sequelize');

// Replace MongoDB Connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
    }
});

// Define Inquiry Model (Replaces mongoose.model('ServiceInquiry'))
const ServiceInquiry = sequelize.define('ServiceInquiry', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    service: { type: DataTypes.STRING, allowNull: false },
    projectDetails: { type: DataTypes.TEXT },
    timeline: { type: DataTypes.STRING }
});

// Sync Database
sequelize.sync();

// ============================================
// DATABASE SCHEMAS & MODELS
// ============================================

// Contact Form Schema
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  service: { type: String, enum: ['Social Media Marketing', 'Photography', 'SEO & Analytics', 'Content Strategy', 'PPC Advertising', 'Email Marketing', 'Brand Development', 'Other'] },
  message: { type: String, required: true },
  budget: { type: String, enum: ['<$5000', '$5000-$10000', '$10000-$25000', '$25000-$50000', '$50000+'] },
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'converted', 'closed'], default: 'new' },
  source: { type: String, default: 'website' },
  createdAt: { type: Date, default: Date.now }
});

// Newsletter Schema
const newsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  name: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now }
});

// Portfolio Schema
const portfolioSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['Branding', 'Social Media', 'SEO', 'Photography', 'Content', 'PPC', 'Web Development'] },
  client: { type: String, trim: true },
  industry: { type: String, trim: true },
  results: [{
    metric: String,
    value: String
  }],
  images: [String],
  pdfFile: String,
  link: String,
  featured: { type: Boolean, default: false },
  publishedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Testimonial Schema
const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  company: { type: String, trim: true },
  content: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  image: String,
  featured: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Service Inquiry Schema
const serviceInquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  service: { type: String, required: true },
  projectDetails: { type: String },
  timeline: { type: String, enum: ['Urgent (< 1 month)', '1-3 months', '3-6 months', '6+ months', 'Flexible'] },
  budget: { type: String },
  referralSource: { type: String },
  status: { type: String, enum: ['pending', 'reviewing', 'quoted', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Admin User Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer' },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  event: { type: String, required: true },
  page: String,
  userId: String,
  sessionId: String,
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

// Create Models
const Contact = mongoose.model('Contact', contactSchema);
const Newsletter = mongoose.model('Newsletter', newsletterSchema);
const Portfolio = mongoose.model('Portfolio', portfolioSchema);
const Testimonial = mongoose.model('Testimonial', testimonialSchema);
const ServiceInquiry = mongoose.model('ServiceInquiry', serviceInquirySchema);
const Admin = mongoose.model('Admin', adminSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = file.fieldname === 'pdf' ? 'uploads/pdfs' : 'uploads/images';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedPdfTypes = /pdf/;
  const extname = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === 'pdf') {
    if (allowedPdfTypes.test(extname)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  } else {
    if (allowedImageTypes.test(extname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// ============================================
// EMAIL CONFIGURATION
// ============================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Email Templates
const emailTemplates = {
  contactConfirmation: (name) => `
    <h2>Thank you for contacting C REO Agency!</h2>
    <p>Dear ${name},</p>
    <p>We've received your message and will get back to you within 24 hours.</p>
    <p>Our team is excited to help transform your brand!</p>
    <br>
    <p>Best regards,<br>C REO Agency Team</p>
  `,
  
  adminNotification: (contact) => `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${contact.name}</p>
    <p><strong>Email:</strong> ${contact.email}</p>
    <p><strong>Phone:</strong> ${contact.phone || 'N/A'}</p>
    <p><strong>Company:</strong> ${contact.company || 'N/A'}</p>
    <p><strong>Service:</strong> ${contact.service || 'N/A'}</p>
    <p><strong>Budget:</strong> ${contact.budget || 'N/A'}</p>
    <p><strong>Message:</strong></p>
    <p>${contact.message}</p>
  `,

  newsletterWelcome: (name) => `
    <h2>Welcome to C REO Agency Newsletter!</h2>
    <p>Hi ${name || 'there'},</p>
    <p>Thank you for subscribing! You'll now receive our latest updates, tips, and exclusive content.</p>
    <p>Stay tuned for digital marketing insights that drive results.</p>
    <br>
    <p>Best regards,<br>C REO Agency Team</p>
  `
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// ============================================
// API ROUTES
// ============================================

// -------------------- PUBLIC ROUTES --------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Contact Form Submission
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, company, service, message, budget } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Save to database
    const contact = new Contact({
      name,
      email,
      phone,
      company,
      service,
      message,
      budget
    });

    await contact.save();

    // Send confirmation email to user
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"C REO Agency" <noreply@creoagency.com>',
        to: email,
        subject: 'Thank You for Contacting C REO Agency',
        html: emailTemplates.contactConfirmation(name)
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    // Send notification to admin
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"C REO Agency" <noreply@creoagency.com>',
        to: process.env.ADMIN_EMAIL || 'admin@creoagency.com',
        subject: 'New Contact Form Submission',
        html: emailTemplates.adminNotification(contact)
      });
    } catch (emailError) {
      console.error('Admin notification error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! We will contact you soon.',
      contactId: contact._id
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

// Newsletter Subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if already subscribed
    const existing = await Newsletter.findOne({ email });
    if (existing) {
      if (existing.isActive) {// ============================================
        // DATABASE CONNECTION
        // ============================================
        
        // Updated connection logic for Mongoose v6+
        mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creo_agency')
        .then(() => console.log('✅ MongoDB Connected'))
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
        return res.status(400).json({ error: 'Email already subscribed' });
      } else {
        existing.isActive = true;
        await existing.save();
        return res.json({ success: true, message: 'Resubscribed successfully!' });
      }
    }

    const subscriber = new Newsletter({ email, name });
    await subscriber.save();

    // Send welcome email
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"C REO Agency" <noreply@creoagency.com>',
        to: email,
        subject: 'Welcome to C REO Agency Newsletter',
        html: emailTemplates.newsletterWelcome(name)
      });
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter!'
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Get Featured Portfolio Items
app.get('/api/portfolio/featured', async (req, res) => {
  try {
    const portfolioItems = await Portfolio.find({ featured: true })
      .sort({ publishedAt: -1 })
      .limit(6)
      .select('-__v');

    res.json({ success: true, data: portfolioItems });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get All Portfolio Items (with pagination)
app.get('/api/portfolio', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;

    const query = category ? { category } : {};
    const skip = (page - 1) * limit;

    const portfolioItems = await Portfolio.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Portfolio.countDocuments(query);

    res.json({
      success: true,
      data: portfolioItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get Single Portfolio Item
app.get('/api/portfolio/:id', async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }

    res.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio item' });
  }
});

// Get Approved Testimonials
app.get('/api/testimonials', async (req, res) => {
  try {
    const featured = req.query.featured === 'true';
    const query = featured ? { isApproved: true, featured: true } : { isApproved: true };

    const testimonials = await Testimonial.find(query)
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({ success: true, data: testimonials });
  } catch (error) {
    console.error('Testimonials fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// Submit Service Inquiry
app.post('/api/service-inquiry', async (req, res) => {
  try {
    const { name, email, phone, service, projectDetails, timeline, budget, referralSource } = req.body;

    if (!name || !email || !service) {
      return res.status(400).json({ error: 'Name, email, and service are required' });
    }

    const inquiry = new ServiceInquiry({
      name,
      email,
      phone,
      service,
      projectDetails,
      timeline,
      budget,
      referralSource
    });

    await inquiry.save();

    res.status(201).json({
      success: true,
      message: 'Service inquiry submitted successfully!',
      inquiryId: inquiry._id
    });

  } catch (error) {
    console.error('Service inquiry error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// Track Analytics
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { event, page, userId, sessionId, metadata } = req.body;

    const analytics = new Analytics({
      event,
      page,
      userId,
      sessionId,
      metadata,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    await analytics.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// -------------------- ADMIN AUTHENTICATION --------------------

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username, isActive: true });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create First Admin (run once)
app.post('/api/admin/setup', async (req, res) => {
  try {
    // Check if any admin exists
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new Admin({
      username,
      email,
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully'
    });

  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// -------------------- ADMIN PROTECTED ROUTES --------------------

// Get All Contacts (Admin)
app.get('/api/admin/contacts', authenticateToken, authorizeRole('admin', 'editor', 'viewer'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contact.countDocuments(query);

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Contacts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Update Contact Status (Admin)
app.patch('/api/admin/contacts/:id', authenticateToken, authorizeRole('admin', 'editor'), async (req, res) => {
  try {
    const { status } = req.body;
    
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('Contact update error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Create Portfolio Item (Admin)
app.post('/api/admin/portfolio', authenticateToken, authorizeRole('admin', 'editor'), 
  upload.fields([{ name: 'images', maxCount: 5 }, { name: 'pdf', maxCount: 1 }]), 
  async (req, res) => {
  try {
    const { title, description, category, client, industry, results, link, featured } = req.body;

    const images = req.files['images'] ? req.files['images'].map(file => `/uploads/images/${file.filename}`) : [];
    const pdfFile = req.files['pdf'] ? `/uploads/pdfs/${req.files['pdf'][0].filename}` : null;

    const portfolio = new Portfolio({
      title,
      description,
      category,
      client,
      industry,
      results: results ? JSON.parse(results) : [],
      images,
      pdfFile,
      link,
      featured: featured === 'true'
    });

    await portfolio.save();

    res.status(201).json({
      success: true,
      message: 'Portfolio item created successfully',
      data: portfolio
    });

  } catch (error) {
    console.error('Portfolio creation error:', error);
    res.status(500).json({ error: 'Failed to create portfolio item' });
  }
});

// Update Portfolio Item (Admin)
app.put('/api/admin/portfolio/:id', authenticateToken, authorizeRole('admin', 'editor'),
  upload.fields([{ name: 'images', maxCount: 5 }, { name: 'pdf', maxCount: 1 }]),
  async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.files['images']) {
      updateData.images = req.files['images'].map(file => `/uploads/images/${file.filename}`);
    }

    if (req.files['pdf']) {
      updateData.pdfFile = `/uploads/pdfs/${req.files['pdf'][0].filename}`;
    }

    if (updateData.results) {
      updateData.results = JSON.parse(updateData.results);
    }

    const portfolio = await Portfolio.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }

    res.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Portfolio update error:', error);
    res.status(500).json({ error: 'Failed to update portfolio item' });
  }
});

// Delete Portfolio Item (Admin)
app.delete('/api/admin/portfolio/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const portfolio = await Portfolio.findByIdAndDelete(req.params.id);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }

    res.json({ success: true, message: 'Portfolio item deleted successfully' });
  } catch (error) {
    console.error('Portfolio deletion error:', error);
    res.status(500).json({ error: 'Failed to delete portfolio item' });
  }
});

// Get All Testimonials (Admin)
app.get('/api/admin/testimonials', authenticateToken, authorizeRole('admin', 'editor', 'viewer'), async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json({ success: true, data: testimonials });
  } catch (error) {
    console.error('Testimonials fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// Create Testimonial (Admin)
app.post('/api/admin/testimonials', authenticateToken, authorizeRole('admin', 'editor'), async (req, res) => {
  try {
    const testimonial = new Testimonial(req.body);
    await testimonial.save();

    res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      data: testimonial
    });
  } catch (error) {
    console.error('Testimonial creation error:', error);
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
});

// Update Testimonial (Admin)
app.put('/api/admin/testimonials/:id', authenticateToken, authorizeRole('admin', 'editor'), async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json({ success: true, data: testimonial });
  } catch (error) {
    console.error('Testimonial update error:', error);
    res.status(500).json({ error: 'Failed to update testimonial' });
  }
});

// Delete Testimonial (Admin)
app.delete('/api/admin/testimonials/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Testimonial deletion error:', error);
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

// Get Analytics Dashboard Data (Admin)
app.get('/api/admin/analytics/dashboard', authenticateToken, authorizeRole('admin', 'viewer'), async (req, res) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const totalSubscribers = await Newsletter.countDocuments({ isActive: true });
    const totalInquiries = await ServiceInquiry.countDocuments();
    const totalPortfolio = await Portfolio.countDocuments();
    
    // Get recent contacts
    const recentContacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email service status createdAt');

    // Get contacts by status
    const contactsByStatus = await Contact.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get inquiries by service
    const inquiriesByService = await ServiceInquiry.aggregate([
      { $group: { _id: '$service', count: { $sum: 1 } } }
    ]);

    // Get monthly contacts (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyContacts = await Contact.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalContacts,
          totalSubscribers,
          totalInquiries,
          totalPortfolio
        },
        recentContacts,
        contactsByStatus,
        inquiriesByService,
        monthlyContacts
      }
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get Service Inquiries (Admin)
app.get('/api/admin/inquiries', authenticateToken, authorizeRole('admin', 'editor', 'viewer'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const inquiries = await ServiceInquiry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ServiceInquiry.countDocuments(query);

    res.json({
      success: true,
      data: inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Inquiries fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

// Update Inquiry Status (Admin)
app.patch('/api/admin/inquiries/:id', authenticateToken, authorizeRole('admin', 'editor'), async (req, res) => {
  try {
    const { status } = req.body;
    
    const inquiry = await ServiceInquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('Inquiry update error:', error);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

// Get Newsletter Subscribers (Admin)
app.get('/api/admin/newsletter', authenticateToken, authorizeRole('admin', 'editor', 'viewer'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const subscribers = await Newsletter.find({ isActive: true })
      .sort({ subscribedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Newsletter.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: subscribers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Newsletter fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Export Contacts to CSV (Admin)
app.get('/api/admin/contacts/export', authenticateToken, authorizeRole('admin', 'editor'), async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    // Create CSV content
    const csvHeader = 'Name,Email,Phone,Company,Service,Budget,Status,Message,Date\n';
    const csvRows = contacts.map(contact => {
      return `"${contact.name}","${contact.email}","${contact.phone || ''}","${contact.company || ''}","${contact.service || ''}","${contact.budget || ''}","${contact.status}","${contact.message.replace(/"/g, '""')}","${contact.createdAt.toISOString()}"`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(csv);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export contacts' });
  }
});

// Send Newsletter Email (Admin)
app.post('/api/admin/newsletter/send', authenticateToken, authorizeRole('admin', 'editor'), async (req, res) => {
  try {
    const { subject, htmlContent } = req.body;

    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Subject and content are required' });
    }

    const subscribers = await Newsletter.find({ isActive: true });

    if (subscribers.length === 0) {
      return res.status(400).json({ error: 'No active subscribers found' });
    }

    // Send emails in batches to avoid overwhelming SMTP server
    const batchSize = 50;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const emailPromises = batch.map(subscriber => {
        return transporter.sendMail({
          from: process.env.SMTP_FROM || '"C REO Agency" <newsletter@creoagency.com>',
          to: subscriber.email,
          subject: subject,
          html: htmlContent
        })
        .then(() => sentCount++)
        .catch(err => {
          console.error(`Failed to send to ${subscriber.email}:`, err);
          failedCount++;
        });
      });

      await Promise.all(emailPromises);
      
      // Small delay between batches
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.json({
      success: true,
      message: 'Newsletter sent',
      stats: {
        total: subscribers.length,
        sent: sentCount,
        failed: failedCount
      }
    });

  } catch (error) {
    console.error('Newsletter send error:', error);
    res.status(500).json({ error: 'Failed to send newsletter' });
  }
});

// Get Analytics Events (Admin)
app.get('/api/admin/analytics/events', authenticateToken, authorizeRole('admin', 'viewer'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const event = req.query.event;
    const skip = (page - 1) * limit;

    const query = event ? { event } : {};

    const events = await Analytics.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select('-userAgent -__v');

    const total = await Analytics.countDocuments(query);

    // Get event summary
    const eventSummary = await Analytics.aggregate([
      { $group: { _id: '$event', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: events,
      summary: eventSummary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Analytics events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics events' });
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 5000;


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  C REO AGENCY - BACKEND API SERVER      ║
║   Status: Running ✅                      ║
║   Port: ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
╚═══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await mongoose.connection.close();
  process.exit(0);
});
