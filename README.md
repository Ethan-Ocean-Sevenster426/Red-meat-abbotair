# RMAA ERP System

Enterprise Resource Planning system for the Red Meat Abattoir Association (RMAA). Built with React + Vite (frontend) and Django + MySQL (backend).

---

## Prerequisites

- **Node.js** v18+
- **Python** 3.11+
- **MySQL** 8.0+ (or SQLite for local dev)
- **Microsoft Office (Excel)** or **LibreOffice** — required for STT training register PDF conversion (fit-to-page export)
- **Microsoft Graph API** credentials (for email sending)
- **npm** v9+

---

## Quick Start

```bash
# 1. Clone and configure environment
cd "RMAA System"
cp .env.example .env
# Edit .env with your database and Graph API credentials

# 2. Set up the backend (Django)
cd backend

# Windows:
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# Linux/macOS:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Run migrations and seed data
python manage.py migrate
python manage.py seed_users
python manage.py seed_from_xlsx --truncate    # seeds from seed-data/*.xlsx

# 4. Install frontend dependencies (from project root)
cd ..
npm install

# 5. Start both frontend and backend
npm start
```

This runs:
- **Backend API** on `http://localhost:8000`
- **Frontend** on `http://localhost:5173` (Vite dev server, proxies `/api` to backend)

### Run individually

```bash
# Backend only (from project root)
npm run start:backend

# Frontend only
npm run dev
```

---

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Django
DJANGO_SECRET_KEY=change-me-generate-a-real-secret
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=your-domain.com,127.0.0.1

# Database — MySQL (production) or sqlite (dev only)
DB_ENGINE=mysql          # set to "sqlite" for local dev without MySQL
DB_USER=rmaa
DB_PASSWORD=your-strong-password
DB_SERVER=127.0.0.1
DB_PORT=3306
DB_DATABASE=rmaa

# Microsoft Graph API — for sending invitation emails, quotes, database forms
GRAPH_TENANT_ID=your-tenant-id
GRAPH_CLIENT_ID=your-client-id
GRAPH_CLIENT_SECRET=your-client-secret
GRAPH_SENDER_EMAIL=sender@yourdomain.com

# Frontend base URL (used in invitation emails)
APP_BASE_URL=https://your-domain.com
```

### Database Setup

Tables are managed via Django migrations. Run `python manage.py migrate` from the `backend/` directory to create or update the schema.

| Table | Description |
|-------|-------------|
| `Users` | Authentication and user management |
| `Invitations` | User invitation tokens |
| `AbattoirMaster` | Registered abattoir directory (600+ records) |
| `TransformationMaster` | Transformation facility data |
| `GovernmentMaster` | Government contacts |
| `IndustryMaster` | Industry stakeholder data |
| `AssociatedMembersMaster` | Associated member organisations |
| `STTTrainingReport` | STT training records (4500+ records) |
| `TrainingReport` | General training records |
| `Learners` | Learner records linked to training data |
| `Facilitators` | Training facilitator records |
| `FeeStructure` | Fee structure / pricing data |
| `ResidueMonitoring` / `ResidueMonitoringTemp` | Residue monitoring data |
| `CustomAbattoirs` | User-added abattoir names (not in master list) |
| `AuditLog` | Central change tracking across all tables |
| `UserColumnPreferences` | Per-user column visibility and order |

### Microsoft Graph API Setup

Email sending and Excel-to-PDF conversion use Microsoft Graph API. You need:

1. Register an app in **Azure Active Directory** (Entra ID)
2. Grant these **application permissions** (not delegated):
   - `Mail.Send` — send emails on behalf of the sender account
   - `Files.ReadWrite.All` — upload Excel to OneDrive for PDF conversion
3. Create a **client secret** under Certificates & Secrets
4. **Admin consent** must be granted for the permissions
5. Set the 4 `GRAPH_*` variables in `.env`

If Graph API is not configured, the app still works but email sending and PDF conversion features will fail gracefully.

---

## Project Structure

```
RMAA System/
├── backend/                       # Backend (Django)
│   ├── manage.py                  # Django management CLI
│   ├── requirements.txt           # Python dependencies
│   ├── rmaa_backend/              # Django project settings
│   │   ├── settings.py            # Database, middleware, app config
│   │   ├── urls.py                # Root URL config (mounts /api/)
│   │   ├── wsgi.py                # WSGI entry point
│   │   └── asgi.py                # ASGI entry point
│   └── api/                       # Django app — models, views, routes
│       ├── models.py              # All database models (Django ORM)
│       ├── views.py               # API views (CRUD, import, email, etc.)
│       ├── urls.py                # API URL routing (/api/...)
│       ├── helpers.py             # Shared CRUD helpers, pagination, audit
│       ├── column_maps.py         # Column definitions per model
│       ├── email.py               # Microsoft Graph: email sending + PDF conversion
│       ├── management/commands/
│       │   ├── seed_users.py      # Create default admin user
│       │   └── seed_from_xlsx.py  # Seed database from seed-data/*.xlsx
│       └── migrations/            # Django database migrations
│
├── seed-data/                     # Excel files for initial data seeding
│
├── src/                           # Frontend (React 18 + Vite)
│   ├── main.jsx                   # App entry point
│   ├── App.jsx                    # Route definitions
│   ├── auth.jsx                   # Auth context, JWT handling, ProtectedRoute
│   ├── styles.css                 # Global styles (scoped to login container)
│   ├── components/
│   │   ├── AuditLogModal.jsx      # Change log modal (reused by all data tables)
│   │   ├── ColFilterDropdown.jsx  # Per-column searchable filter dropdown
│   │   ├── ColVisibilityPanel.jsx # Column show/hide + drag-to-reorder panel
│   │   └── ProtectedRoute.jsx     # Route guard component
│   ├── pages/
│   │   ├── Dashboard.jsx          # Home page with navigation tiles
│   │   ├── Login.jsx              # Login form
│   │   ├── UserManagement.jsx     # User admin, roles, permissions, invitations
│   │   ├── RegisteredAbattoirs.jsx# Abattoir master data (inline editing, filters)
│   │   ├── Transformation.jsx     # Transformation data table
│   │   ├── Government.jsx         # Government contacts table
│   │   ├── Industry.jsx           # Industry stakeholders table
│   │   ├── AssociatedMembers.jsx  # Associated members table
│   │   ├── STTTrainingReport.jsx  # STT training data (Excel upload, ID check)
│   │   ├── STTBreakdownReport.jsx # Training analytics: charts + table + PDF export
│   │   ├── ResidueMonitoring.jsx  # Residue data import, validation, commit
│   │   ├── QuotationSystem.jsx    # Quotation builder: form, PDF preview, email
│   │   ├── DocumentLibrary.jsx    # File browser with folder tree
│   │   ├── ARMSDashboard.jsx      # Embedded Power BI report
│   │   ├── MasterDatabase.jsx     # Navigation hub for database sub-pages
│   │   ├── TrainingReport.jsx     # Navigation hub for training sub-pages
│   │   ├── FormalTrainingReport.jsx # Placeholder (under construction)
│   │   ├── FeedlotResidue.jsx     # Placeholder (under construction)
│   │   ├── AcceptInvite.jsx       # Invitation acceptance + password setup
│   │   └── Unauthorized.jsx       # Access denied page
│   └── utils/
│       └── exportStyledExcel.js   # Shared styled Excel export (ExcelJS)
│
├── documents/                     # Document library file storage (auto-created)
│   └── {Province}/{Abattoir}/     # Auto-organized by province and abattoir name
│
├── Quotation Template.xlsx        # Excel template for quotation generation
├── vite.config.js                 # Vite config with /api proxy to :8000
├── package.json                   # Frontend deps + npm start (runs both)
├── .env                           # Environment variables (not committed)
├── .env.example                   # Template for .env
└── README.md
```

---

## API Endpoints

All endpoints are prefixed with `/api`. The Vite dev server proxies `/api/*` to `http://localhost:8000`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login with username/password, returns JWT |

### Data Tables

Each table follows the same REST pattern:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/{table}?page=1&size=50&sortCol=name&sortDir=asc&name=search` | Paginated list with column filters |
| GET | `/{table}/count` | Total row count |
| POST | `/{table}` | Create new row |
| PUT | `/{table}/:id` | Update row (writes to AuditLog if fields changed) |
| DELETE | `/{table}/:id` | Delete row |
| GET | `/{table}/:id/history` | Change history from AuditLog |

**Table prefixes:**

| Prefix | Database Table | Page |
|--------|---------------|------|
| `/api/abattoir` | AbattoirMaster | Registered Abattoirs |
| `/api/transformation` | TransformationMaster | Transformation |
| `/api/government` | GovernmentMaster | Government |
| `/api/industry` | IndustryMaster | Industry |
| `/api/associated-members` | AssociatedMembersMaster | Associated Members |
| `/api/stt-training-report` | STTTrainingReport | STT Training Report |
| `/api/training-report` | TrainingReport | Training Report |
| `/api/learners` | Learners | Learner Records |
| `/api/facilitators` | Facilitators | Facilitator Records |
| `/api/fee-structure` | FeeStructure | Fee Structure |
| `/api/residue` | ResidueMonitoring | Residue Monitoring |

### Special Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-log?table=X&user=Y&year=2025&month=3&days=7` | Central audit log with multi-value filters |
| GET | `/api/abattoir/names` | All abattoir names (registered + custom) for dropdowns |
| POST | `/api/abattoir/custom` | Add a custom abattoir name |
| DELETE | `/api/abattoir/custom/:id` | Delete a custom abattoir name |
| POST | `/api/abattoir/:id/send-database-form` | Email database form for an abattoir |
| GET | `/api/stt-training-report/breakdown?year=2025&month=1,2&province=Gauteng` | Aggregated training breakdown with multi-select filters |
| GET | `/api/stt-training-report/learner-summary` | Learner summary with pagination |
| POST | `/api/stt-training-report/parse-excel` | Parse uploaded Excel training register |
| POST | `/api/stt-training-report/export-pdf` | Generate PDF from Excel + save to document library |
| POST | `/api/learners/merge` | Merge duplicate learner records |
| GET | `/api/facilitators` | List all facilitators |
| DELETE | `/api/facilitators/:id` | Delete a facilitator |
| GET | `/api/quotation/abattoir-details?name=X` | Fetch abattoir details for quotation auto-fill |
| POST | `/api/quotation/generate` | Generate quotation PDF from template (no save) |
| POST | `/api/quotation/send` | Email quotation PDF + save to document library |
| GET/PUT | `/api/user-prefs?page=X&userId=Y` | Column visibility + order preferences |
| GET | `/api/documents/tree` | Document library folder/file tree |
| GET | `/api/documents/view?p=path` | View PDF inline or download file |
| GET | `/api/documents/download?p=path` | Download a document |
| DELETE | `/api/documents/delete?p=path` | Delete a document |
| GET | `/api/residue/template` | Download residue monitoring template |
| POST | `/api/residue/upload` | Upload residue monitoring Excel |
| GET | `/api/residue/temp/:batch_id` | Get temporary residue batch data |
| POST | `/api/residue/commit-rows` | Commit validated residue rows |
| GET | `/api/residue/committed` | List committed residue data |
| DELETE | `/api/residue/committed/all` | Clear all committed residue data |
| PUT | `/api/residue/committed/:id` | Update a committed residue row |
| GET | `/api/users` | List all users (admin) |
| PUT | `/api/users/:id/role` | Change user role (admin) |
| PUT | `/api/users/:id/permissions` | Update user page permissions (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |
| POST | `/api/users/invite` | Send invitation email (admin) |
| GET | `/api/users/invite/:token` | Look up invitation by token |
| POST | `/api/users/invite/accept` | Accept invitation and create account |
| GET | `/api/status` | Simple health check |
| GET | `/api/health` | Detailed DB health check with table row counts |

---

## Key Features

### Data Management (all tables)
- **Inline cell editing** with save/revert per row
- **Column filters** with searchable dropdowns (text search, predefined options, blank filter)
- **Column visibility** with show/hide checkboxes per user
- **Column reorder** with drag-and-drop (persisted per user)
- **Sorting** by clicking column headers (asc/desc toggle)
- **Pagination** at 50 rows per page
- **Record ID** column on all tables for easy reference
- **Add new entry** modal with field validation
- **Delete** with confirmation dialog
- **Export to styled Excel** with formatted headers and alternating row colours

### Audit Trail
- Every edit writes to the central `AuditLog` table with: who, when, which fields, old values, new values
- **Per-record history** modal showing all changes to a specific row
- **Change Log** button on every table page: full audit trail with filters (user, year, month, past 7/30 days)
- Change log export to Excel

### STT Training Report
- **Upload Excel Training Data** — parse Excel attendance registers and commit to database
- **ID Check** — cycle through: Duplicate IDs, Incorrect IDs (not 13 digits), Missing IDs
- **Breakdown Report** — aggregated view with sortable columns
- **Analytics dashboard** — KPI cards + charts (monthly volume, province, species, ethnicity, age, race & gender)
- **Analytics PDF export** — screenshot-to-PDF via html2canvas + jsPDF

### Quotation System (Finances page)
- Select client from Registered Abattoirs (or add custom)
- Auto-populates: RMAA member status, RC Nr, throughput, VAT, province
- Line items: date, skills programme, qty (combined as "Programme x Qty"), slaughter technique, service cost, distance (@ R5.50/km), accommodation (@ R800 pppn)
- All client fields required before review
- Full PDF preview before sending
- Email to client with PDF attachment via Microsoft Graph
- Saves XLSX + PDF to Document Library on send (not on generate)

### Document Library
- Auto-organized folder structure: `{Province}/{Abattoir}/{Category}/`
- Folder tree navigation with expand/collapse
- PDF inline viewer
- File download
- Training documents and quotations auto-filed

### User Management (admin only)
- View all users with roles
- Change user roles (admin/user)
- Per-page permissions (view/edit) for all modules
- Invite new users via email with unique link
- Delete users

---

## Build for Production

```bash
# Build the frontend
npm run build
```

Creates a `dist/` folder. In production, serve the frontend with Nginx (or similar) and run the Django backend via Gunicorn or WSGI:

```bash
cd backend
gunicorn rmaa_backend.wsgi:application --bind 0.0.0.0:8000
```

---

## Default Admin Account

Run `python manage.py seed_users` (from the `backend/` directory) to create the default admin:

| Username | Password | Role |
|----------|----------|------|
| Anthony | Admin | admin |

**Change the password after first login.**

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.3 |
| Build | Vite | 5.4 |
| Routing | React Router | 6.17 |
| Charts | Recharts | 3.8 |
| Backend | Django | 5.2 |
| Database | MySQL | 8.4 |
| Python DB driver | PyMySQL | 1.1 |
| Excel (backend) | openpyxl | 3.1 |
| Excel (frontend) | ExcelJS | 4.4 |
| PDF conversion | pywin32 (Windows) / LibreOffice (Linux) | - |
| PDF (frontend) | jsPDF + html2canvas | 4.2 / 1.4 |
| Email | Microsoft Graph API | - |
| Auth | JWT (custom) | - |

---

## Troubleshooting

### Database connection fails
- Ensure MySQL is running and accepting connections on port 3306
- Check `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE` in `.env`
- For local development, set `DB_ENGINE=sqlite` to use SQLite instead of MySQL

### Tables not created
- Run `python manage.py migrate` from the `backend/` directory
- Check server startup logs for migration errors

### Email sending fails
- Verify all 4 `GRAPH_*` variables in `.env`
- Ensure the Azure AD app has **application permissions** (not delegated) for `Mail.Send`
- **Admin consent** must be granted in Azure portal
- The `GRAPH_SENDER_EMAIL` must be a valid mailbox in the tenant

### PDF conversion fails (STT Training Register)
- PDF conversion uses **Microsoft Excel** (via COM automation) or **LibreOffice** to convert the uploaded Excel attendance register to a single-page portrait A4 PDF with fit-to-page scaling
- **Windows (local dev):** Requires Microsoft Excel installed. The `pywin32` package is used for COM automation
- **Linux (production server):** Install LibreOffice headless: `sudo apt install libreoffice-calc`
- The conversion sets fit-to-page (1 wide x 1 tall), portrait A4, print area `$A$1:$AD$53`
- If neither Excel nor LibreOffice is available, the PDF conversion will fail but data will still be saved

### Vite proxy errors / CORS issues
- Ensure the backend is running on port 8000 **before** starting the frontend
- Use `npm start` to run both concurrently (recommended)
- The proxy config in `vite.config.js` forwards all `/api/*` requests to `http://localhost:8000`

### Excel import fails
- Ensure the Excel file follows the expected column layout
- Check browser console for parse errors
- The server uses openpyxl to read `.xlsx` files (`.xls` not supported)

### Virtual environment issues (Windows)
- If `.venv\Scripts\pip` is not found, ensure Python 3.11+ is on your PATH
- Re-create the venv: `python -m venv .venv --clear`
- Activate before running Django commands: `.venv\Scripts\activate`

### Seed data fails
- Ensure seed files exist in `seed-data/` (e.g., `AbattoirMaster.xlsx`, `Users.xlsx`)
- Run `python manage.py seed_from_xlsx --truncate` to wipe and re-seed
- Run `python manage.py seed_users` to recreate the default admin user
