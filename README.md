# PowerPulse — Smart Electricity Monitoring & Complaint Management System

**PowerPulse** is a complete, full-stack, responsive web application engineered for industrial, institutional, and commercial facility electricity monitoring, excessive consumption anomaly detection, and end-to-end complaint resolution.

Developed for academic demonstration and production-grade facility management, the platform features **strict role-based security across three distinct roles (Admin, Manager, and Viewer)**, separate role-tailored login portals, automated threshold breach alerting, and an interactive complaint tracking lifecycle.

---

## ⚡ Key Highlights & Architecture

- **Strict Three-Role Permission Hierarchy:**
  1. **Admin (`/admin-login.html`):** Master system control, grid-wide analytics, user/manager provisioning, meter registration, alert threshold configuration, and cross-system complaint assignment/reopening.
  2. **Manager (`/manager-login.html`):** Managers have the same access across all locations. The Location Access selector defaults to **All Locations** and filters the overview KPIs and consumption trend when a location is selected; the header always reflects the current selection.
  3. **Viewer (`/viewer-login.html`):** Clean, minimal consumer dashboard showing current kWh load, normal vs. high consumption status indicators, 7-day daily trend, and an integrated **“Report a Problem”** complaint ticket system.
- **Three Separate Dedicated Login Portals:** Separate login URLs (`/admin-login.html`, `/manager-login.html`, `/viewer-login.html`) with role-specific themes, show/hide password toggles, 1-click evaluation demo buttons, and strict server-side role validation.
- **Role-Based Accounts:** The system allows one protected Admin account and multiple Manager accounts with equivalent all-location access. Multiple Viewers can be provisioned by an Admin or self-register from the login screen. Public registration always creates a Viewer account and offers all available locations.
- **Automated Anomaly Detection & Alerts:** Automatically detects excessive power draw (>150 kWh baseline) or critical surges (>200 kWh) and dispatches role-targeted notifications.
- **Interactive Complaint Management:** Complete lifecycle from **Pending** to **In Progress**, **Resolved**, or **Rejected**, complete with audit timelines, resolution summaries, and interactive communication threads.
- **Academic Telemetry Simulation:** Realistic 30-day hourly & daily telemetry data in kilowatt-hours (kWh) with demo notices and interactive simulation triggers.
- **Indian Grid Locations:** Seed locations include Mumbai, Navi Mumbai, Palghar, Thane, Nashik, Nagpur, Delhi, Bengaluru, Pune, Hyderabad, Chennai, Kolkata, Ahmedabad, Jaipur, Lucknow, and Kochi. Admins can add additional city or industrial-area locations from the Locations dashboard.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+), Chart.js, Lucide Icons |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM (includes automatic in-memory fallback) |
| **Authentication** | JSON Web Tokens (JWT) & bcrypt.js password hashing |
| **Security** | Helmet HTTP headers, express-rate-limit, role-based authorization middleware |

---

## 🔑 Pre-Seeded Demo Accounts for Evaluation

PowerPulse comes pre-seeded with realistic data for instant demonstration:

| Role | Portal URL | Login Email | Password | Assigned Scope |
| :--- | :--- | :--- | :--- | :--- |
| **🛡️ System Admin** | [`/admin-login.html`](http://localhost:5000/admin-login.html) | `admin@powerpulse.io` | `admin123` | Full System Access (All Grids & Users) |
| **🏢 Manager (Mumbai)** | [`/manager-login.html`](http://localhost:5000/manager-login.html) | `manager@powerpulse.io` | `manager123` | Mumbai - Kandivali & Mumbai - Malad |
| **🏢 Manager (Pune)** | [`/manager-login.html`](http://localhost:5000/manager-login.html) | `pune.manager@powerpulse.io` | `manager123` | Pune - Hinjewadi Cluster |
| **👤 Viewer (Consumer)** | [`/viewer-login.html`](http://localhost:5000/viewer-login.html) | `viewer@powerpulse.io` | `viewer123` | Mumbai - Kandivali Facility (`MTR-MUM-01`) |
| **👤 Viewer (Pune)** | [`/viewer-login.html`](http://localhost:5000/viewer-login.html) | `viewer.pune@powerpulse.io` | `viewer123` | Pune - Hinjewadi Tech Park (`MTR-PNE-01`) |

> *Tip: Each login page includes a **“Autofill”** button for 1-click evaluation testing.*

---

## 🚀 Installation & Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (Optional: if local MongoDB is not running, the application automatically launches `mongodb-memory-server` in the background)

### Step 1: Clone or Navigate to Directory
```bash
cd POWERPLUSE
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` settings:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/powerpulse
JWT_SECRET=powerpulse_super_secret_jwt_key_2026_college_project
NODE_ENV=development
```

### Step 4: Launch Application
```bash
node server.js
```
The server will automatically connect to MongoDB and seed users, locations, 30 days of hourly readings, alerts, complaints, and notifications.

### Step 5: Open in Web Browser
- **Portal Landing Page:** [http://localhost:5000](http://localhost:5000)
- **Admin Login:** [http://localhost:5000/admin-login.html](http://localhost:5000/admin-login.html)
- **Manager Login:** [http://localhost:5000/manager-login.html](http://localhost:5000/manager-login.html)
- **Viewer Login:** [http://localhost:5000/viewer-login.html](http://localhost:5000/viewer-login.html)

---

## 📡 REST API Summary

### 1. Authentication (`/api/auth`)
- `POST /api/auth/login` — Authenticate credentials with optional `expectedRole` verification.
- `GET /api/auth/me` — Retrieve authenticated user profile (Protected).
- `PUT /api/auth/profile` — Update user name (Protected).
- `PUT /api/auth/change-password` — Change password with current password verification (Protected).
- `POST /api/auth/logout` — Invalidate user session.
- `GET /api/auth/demo-accounts` — Public metadata for demo logins.

### 2. Complaints (`/api/complaints`)
- `POST /api/complaints` — Submit complaint (Generates `CMP-XXXX`, sets `Pending`, triggers notifications).
- `GET /api/complaints` — Role-isolated complaints list (Viewer sees own; Manager and Admin see all).
- `GET /api/complaints/:id` — Detail view with conversation thread and audit timeline.
- `PUT /api/complaints/:id/status` — Manager/Admin updates status (`Pending`, `In Progress`, `Resolved`, `Rejected`) and provides resolution solution.
- `PUT /api/complaints/:id/assign` — Admin assigns complaint to Manager and sets priority.
- `PUT /api/complaints/:id/reopen` — Admin reopens closed case with explanation.
- `POST /api/complaints/:id/messages` — Send follow-up communication between Viewer and Manager/Admin.

### 3. Analytics & Telemetry (`/api/analytics`, `/api/readings`)
- `GET /api/analytics/viewer-overview` — Dedicated fast summary for Viewer dashboard (KPIs, status, 7-day trend).
- `GET /api/analytics/summary` — High-level metrics (total kWh, peak kW, cost, active meters, carbon footprint).
- `GET /api/analytics/trend` — Date-wise consumption trend for Chart.js line charts.
- `GET /api/analytics/location-wise` — Location breakdown for Chart.js comparison bar charts.
- `GET /api/readings` — Paginated electricity telemetry with role-based filtering.
- `POST /api/readings` — Record a meter reading (Manager & Admin only). The meter determines its location; date and time default to the current India local time when omitted.

### 4. Administrative Control (`/api/users`, `/api/locations`, `/api/meters`, `/api/settings`)
- `GET /api/users` & `POST /api/users` — Admin user management with role & location assignment.
- `PUT /api/users/:id/toggle-status` — Deactivate or activate accounts.
- `GET /api/locations` & `POST /api/locations` — Regional grid management.
- `GET /api/meters` & `POST /api/meters` — Sub-meter hardware management.
- `GET /api/settings` & `PUT /api/settings` — Configure high/critical alert thresholds and billing tariffs.

### 5. In-App Notifications (`/api/notifications`)
- `GET /api/notifications` — Retrieve user-specific alerts and updates.
- `PUT /api/notifications/:id/read` — Mark notification as read.
- `PUT /api/notifications/read-all` — Mark all notifications as read.

---

## 🧪 Demonstration & Evaluation Walkthrough

Follow these steps for an evaluation demonstration:

1. **Step 1 — Consumer Reports Problem:**
   - Log in at `/viewer-login.html` using `viewer@powerpulse.io` / `viewer123`.
   - Observe the Electricity Overview: latest recorded usage, today's total, monthly cost, and 7-day usage chart.
   - Click **“Report a Problem”**, select category *“Incorrect electricity reading”*, type title and description, and click **Submit**.
   - Note the newly generated ticket ID (e.g. `CMP-1005`) marked as **Pending**.

2. **Step 2 — Regional Manager Investigates & Resolves:**
   - Log in at `/manager-login.html` using `manager@powerpulse.io` / `manager123`.
   - Note that the manager only sees data for **Mumbai - Kandivali** and **Mumbai - Malad**.
   - Navigate to **“Assigned Complaints”** and open the newly submitted ticket.
   - Update status to **“In Progress”** and enter response: *“Technician dispatched to inspect current transformer”*.
   - Send a message in the thread: *“Can you verify if breaker #4 was active?”*.
   - Mark as **“Resolved”** and supply solution: *“Recalibrated CT sensor and issued 15 kWh credit”*.

3. **Step 3 — Consumer Verifies Resolution:**
   - Return to `/viewer-dashboard.html`.
   - Check the in-app notification bell indicating the complaint was resolved.
   - Open the complaint to view the manager's resolution and thread.

4. **Step 4 — Administrator System Control:**
   - Log in at `/admin-login.html` using `admin@powerpulse.io` / `admin123`.
   - Inspect global analytics across all locations and meters.
   - Reopen or reassign complaints, provision new user accounts, and adjust alert thresholds in System Settings.

---

## 👨‍💻 Academic IT Project Details

- **Project Title:** PowerPulse – Smart Electricity Monitoring System
- **Level:** Third-Year B.Tech Information Technology Project Demonstration
- **Theme:** Switchable dark and light palettes. Dark mode uses jet black, cerulean blue, and neon rose; light mode uses mocha brown, platinum silver, and pale lavender.
- **Compliance:** OWASP password hashing (bcrypt), Server-side role authorization, CSP-compliant headers.
