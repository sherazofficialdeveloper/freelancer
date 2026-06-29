# Farelanceru 🎨💼

Welcome to **Farelanceru**, a full-stack, secure freelancing marketplace project inspired by **Fiverr** and **GrapeTask**. 

This application uses a strict **MVC architectural pattern** with **REST API routes** and is designed with a vivid blue-to-purple gradient theme. To make it ready with zero external configurations, Farelanceru is equipped with a **dynamic database router** that falls back to a highly realistic, self-contained JSON file-system storage engine if no MongoDB string is supplied!

---

## 🚀 Key Features

* **Strict MVC Architecture**: Features a modular organization where controllers interact with schemas, routes organize routers, and middlewares guard actions.
* **Role-Based Access Controls (RBAC)**: Supports distinct interface roles: **Freelancers** (Bidders), **Buyers** (Employers), and **Admins** (Platform Managers).
* **Double-Sided Escrow Contracting**:
  * Employers deposit project budgets into secure escrows upon job creation or hiring.
  * Freelancers submit completed job assets (descriptions and file links) through the contract card.
  * Employers verify results and approve milestones to instantly release payment.
* **Synchronized Chat Systems**: Dynamic messaging history with 3-second live polling to mimic real-time sockets seamlessly on static HTML layouts.
* **Wallet System**: Demo accounts come pre-loaded with testing balances ($2000 for Buyers, $100 for Freelancers) to let you test the platform instantly.
* **Admin Dashboard Workspace**: Platform-wide monitoring of accounts registries, open gig modulations, and total funds held in escrow.

---

## 📁 Project Structure

```text
Farelanceru/
│
├── frontend/                     # Pure static interface layout
│   ├── assets/
│   │   ├── css/
│   │   │   ├── style.css         # Typography, central tokens, Toast banners
│   │   │   ├── home.css          # Hero banner and styling grids
│   │   │   ├── dashboard.css     # Tables, sidebars, wallet metrics
│   │   │   ├── admin.css         # Graphs counters, admin block lists
│   │   │   └── responsive.css    # Mobile scaling media queries
│   │   │
│   │   └── js/
│   │       ├── main.js           # Header, footer, session managers, Toasts
│   │       ├── auth.js           # Registration & SignIn form submits
│   │       ├── jobs.js           # Gigs listing board & pitching modals
│   │       ├── chat.js           # Messages inbox scrolling & threads polling
│   │       └── dashboard.js      # Milestones uploads & escrow payments
│   │
│   ├── pages/
│   │   ├── index.html            # Landing page
│   │   ├── about.html            # Documentation
│   │   ├── jobs.html             # Jobs browser
│   │   ├── freelancers.html      # Talent experts directory
│   │   ├── login.html            # Credentials login form
│   │   ├── register.html         # Signup role selector
│   │   ├── dashboard.html        # Interactive portal splits
│   │   ├── chat.html             # Conversations inbox
│   │   └── admin.html            # Moderate control center
│   │
│   └── components/
│       ├── navbar.html           # Reusable navigation
│       ├── footer.html           # Brand footer
│       └── sidebar.html          # Operational sidebar directories
│
└── backend/                      # Node/Express API MVC
    ├── config/
    │   ├── db.js                 # Dynamic MongoDB / JSON Fallback driver
    │   └── dotenv.config.js     # Env loader
    │
    ├── models/                   # Strict database schemas
    │   ├── User.js
    │   ├── Job.js
    │   ├── Bid.js
    │   ├── Chat.js
    │   └── Payment.js
    │
    ├── controllers/              # REST operational controllers
    │   ├── auth.controller.js
    │   ├── job.controller.js
    │   ├── bid.controller.js
    │   ├── chat.controller.js
    │   └── admin.controller.js
    │
    ├── routes/                   # Routing blueprints
    │   ├── auth.routes.js
    │   ├── job.routes.js
    │   ├── bid.routes.js
    │   ├── chat.routes.js
    │   └── admin.routes.js
    │
    ├── middleware/               # Auth & Role verification guards
    │   ├── auth.middleware.js
    │   └── role.middleware.js
    │
    └── server.js                 # Central Express Bootstrap Entrypoint
```

---

## 🛠️ Setup & Execution

### 1. Requirements

* Node.js >= 16.x
* npm

### 2. Startup Commands

```bash
# Install NPM packages
npm install

# Start Express Development Server (Live on Port 3000)
npm run dev
```

---

## 🛡️ Trust, Safety & Escrow Architecture

Farelanceru enforces transaction clarity. Rather than sending wire transfers or peer payments, Farelanceru acts as a safe-deposit intermediary:

1. **Escrow Locked**: A buyer client publishes a gig containing instructions, locking the budget up front from their balance.
2. **Accept & Hire**: When a proposal bid is approved, the escrow funds are bound directly to the hired talent's progress ledger.
3. **Delivery Review**: The talent uploads completed deliverables.
4. **Escrow Disbursed**: Payout is delivered to the talent's available balance upon employer approval.
