# 🎯 C REO Agency — Backend API

**Stack:** Node.js + Express · Supabase (PostgreSQL) · Render (API hosting) · Vercel (Frontend) · Cloudinary (Files)

---

## 📁 Project Structure

```
creo-backend/
├── server.js               # Main entry point
├── package.json
├── render.yaml             # Render deployment config
├── vercel.json             # Vercel frontend config
├── .env.example            # Environment variables template
├── config/
│   ├── db.js               # Supabase/PostgreSQL connection pool
│   └── cloudinary.js       # Cloudinary upload config
├── middleware/
│   └── auth.js             # JWT authentication & role authorization
├── routes/
│   ├── contacts.js         # Contact form + admin management
│   ├── newsletter.js       # Subscribe/unsubscribe + bulk send
│   ├── portfolio.js        # Portfolio CRUD + image/PDF upload
│   ├── testimonials.js     # Testimonials CRUD
│   ├── inquiries.js        # Service inquiry form
│   ├── analytics.js        # Event tracking
│   └── admin.js            # Login + dashboard analytics
└── utils/
    ├── mailer.js            # Nodemailer email helpers
    ├── migrate.js           # DB migration script
    └── seedAdmin.js         # Seed first admin account
```

---

## 🚀 Deployment Guide

### Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Go to **Settings → Database → Connection string (URI)**
3. Copy the `postgresql://...` string — this is your `DATABASE_URL`

### Step 2 — Set Up Cloudinary

1. Go to [cloudinary.com](https://cloudinary.com) → Sign up free
2. From your dashboard, copy: `Cloud Name`, `API Key`, `API Secret`

### Step 3 — Set Up Gmail SMTP

1. Enable 2FA on your Gmail account
2. Go to **myaccount.google.com/apppasswords**
3. Create an app password for "Mail" → copy the 16-char password

### Step 4 — Deploy Backend to Render

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo
3. Set **Build Command:** `npm install`
4. Set **Start Command:** `npm start`
5. Add all environment variables from `.env.example` in the Render dashboard
6. Deploy → copy your Render URL (e.g. `https://creo-agency.onrender.com`)

### Step 5 — Run Database Migrations

After Render deploys (or locally with your DATABASE_URL set):

```bash
# Run from your local machine with .env configured
node utils/migrate.js    # Creates all tables in Supabase
node utils/seedAdmin.js  # Creates first admin account
```

### Step 6 — Deploy Frontend to Vercel

1. Put your `index.html` in a `/public` folder
2. Update `API_BASE` in the HTML to your Render URL
3. Push to GitHub → connect to [vercel.com](https://vercel.com)
4. Set `FRONTEND_URL` in Render env vars to your Vercel URL

---

## 🔌 API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/health` | Health check |
| POST   | `/api/contact` | Submit contact form |
| POST   | `/api/newsletter/subscribe` | Subscribe to newsletter |
| POST   | `/api/newsletter/unsubscribe` | Unsubscribe |
| GET    | `/api/portfolio` | List portfolio (paginated) |
| GET    | `/api/portfolio/featured` | Featured items only |
| GET    | `/api/portfolio/:id` | Single portfolio item |
| GET    | `/api/testimonials` | Approved testimonials |
| POST   | `/api/service-inquiry` | Submit service inquiry |
| POST   | `/api/analytics/track` | Track analytics event |

### Admin Endpoints (JWT required)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST   | `/api/admin/login` | public | Get JWT token |
| POST   | `/api/admin/setup` | public | First-time setup |
| GET    | `/api/admin/me` | any | Current admin info |
| GET    | `/api/admin/analytics/dashboard` | admin/viewer | Full stats |
| GET    | `/api/admin/analytics/events` | admin/viewer | Raw events |
| GET    | `/api/contact/admin` | any | All contacts |
| PATCH  | `/api/contact/admin/:id` | admin/editor | Update status |
| DELETE | `/api/contact/admin/:id` | admin | Delete |
| GET    | `/api/contact/admin/export/csv` | admin/editor | Download CSV |
| GET    | `/api/newsletter/admin` | any | All subscribers |
| POST   | `/api/newsletter/admin/send` | admin/editor | Bulk send |
| POST   | `/api/portfolio/admin` | admin/editor | Create item |
| PUT    | `/api/portfolio/admin/:id` | admin/editor | Update item |
| DELETE | `/api/portfolio/admin/:id` | admin | Delete item |
| GET    | `/api/testimonials/admin` | any | All testimonials |
| POST   | `/api/testimonials/admin` | admin/editor | Create |
| PUT    | `/api/testimonials/admin/:id` | admin/editor | Update |
| DELETE | `/api/testimonials/admin/:id` | admin | Delete |
| GET    | `/api/service-inquiry/admin` | any | All inquiries |
| PATCH  | `/api/service-inquiry/admin/:id` | admin/editor | Update status |

### Admin Authentication

```javascript
// 1. Login
const res = await fetch('https://your-api.onrender.com/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'creo_admin', password: 'CreoAdmin2025!' })
});
const { token } = await res.json();

// 2. Use token in subsequent requests
const contacts = await fetch('/api/contact/admin', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 👥 Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access — read, write, delete |
| `editor` | Read + write, no delete |
| `viewer` | Read-only |

---

## ⚙️ Local Development

```bash
git clone <your-repo>
cd creo-backend
npm install
cp .env.example .env     # Fill in your values
node utils/migrate.js    # Set up DB tables
node utils/seedAdmin.js  # Create admin user
npm run dev              # Start with nodemon
```

Server runs at `http://localhost:5000`
