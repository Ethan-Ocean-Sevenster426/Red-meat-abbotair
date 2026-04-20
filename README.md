# RMAA ERP System

Enterprise Resource Planning system for the Red Meat Abattoir Association (RMAA). Built with React + Vite (frontend) and Express + SQL Server (backend).

---

## Prerequisites

- **Node.js** v18+ (ESM modules required)
- **Microsoft SQL Server** 2019+ (or SQL Server Express)
- **Microsoft Graph API** credentials (for email and PDF conversion)
- **npm** v9+

---

## Quick Start

```bash
# 1. Clone and install
cd "RMAA System"
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database and Graph API credentials

# 3. Start both frontend and backend
npm start
```

This runs:
- **Backend API** on `http://localhost:4000`
- **Frontend** on `http://localhost:5173` (Vite dev server, proxies `/api` to backend)

### Run individually

```bash
# Backend only
npm run start:server

# Frontend only
npm run dev

# Test database connection
npm run test:db
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=4000

# SQL Server Database
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=RMAAAuthDB

# Microsoft Graph API (for email sending and PDF conversion)
GRAPH_TENANT_ID=your_tenant_id
GRAPH_CLIENT_ID=your_client_id
GRAPH_CLIENT_SECRET=your_client_secret
GRAPH_SENDER_EMAIL=sender@yourdomain.com
```

### Database Setup

The application **auto-creates all tables** on first startup. No manual schema setup is required. When the server starts, `server/db.js` runs migrations that create any missing tables:

| Table | Description |
|-------|-------------|
| `Users` | Authentication and user management |
| `AbattoirMaster` | Registered abattoir directory (600+ records) |
| `TransformationMaster` | Transformation facility data |
| `GovernmentMaster` | Government contacts |
| `IndustryMaster` | Industry stakeholder data |
| `AssociatedMembersMaster` | Associated member organisations |
| `STTTrainingReport` | STT training records (4500+ records) |
| `TrainingReport` | General training records |
| `ResidueMonitoring` / `ResidueMonitoringTemp` | Residue monitoring data |
| `CustomAbattoirs` | User-added abattoir names (not in master list) |
| `AuditLog` | Central change tracking across all tables |
| `UserColumnPreferences` | Per-user column visibility and order |
| `Invitations` | User invitation tokens |

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
├── server/                        # Backend (Express.js)
│   ├── index.js                   # Server entry point, route registration
│   ├── db.js                      # Database connection pool, table auto-migration
│   ├── email.js                   # Microsoft Graph: email sending + PDF conversion
│   └── routes/
│       ├── auth.js                # Login, registration, JWT tokens
│       ├── abattoir.js            # Registered Abattoirs CRUD + Excel import + email
│       ├── associatedMembers.js   # Associated Members CRUD
│       ├── auditLog.js            # Central audit log with filtering + name joins
│       ├── documents.js           # Document library (tree, view, download, delete)
│       ├── government.js          # Government contacts CRUD
│       ├── industry.js            # Industry stakeholders CRUD
│       ├── quotation.js           # Quotation: generate from template, PDF, email
│       ├── residue.js             # Residue monitoring: Excel import + committed data
│       ├── sttTrainingReport.js   # STT training CRUD + breakdown aggregation + Excel parse
│       ├── trainingReport.js      # General training CRUD
│       ├── transformation.js      # Transformation facilities CRUD
│       ├── users.js               # User management (admin only)
│       └── userPreferences.js     # Column visibility + drag order per user
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
├── vite.config.js                 # Vite config with /api proxy to :4000
├── package.json
├── .env                           # Environment variables (not committed)
└── README.md
```

---

## API Endpoints

All endpoints are prefixed with `/api`. The Vite dev server proxies `/api/*` to `http://localhost:4000`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login with username/password, returns JWT |
| POST | `/api/register` | Register via invitation token |

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
| `/api/residue` | ResidueMonitoring | Residue Monitoring |

### Special Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-log?table=X&user=Y&year=2025&month=3&days=7` | Central audit log with multi-value filters |
| GET | `/api/abattoir/names` | All abattoir names (registered + custom) for dropdowns |
| POST | `/api/abattoir/custom` | Add a custom abattoir name |
| GET | `/api/stt-training-report/breakdown?year=2025&month=1,2&province=Gauteng` | Aggregated training breakdown with multi-select filters |
| POST | `/api/stt-training-report/parse-excel` | Parse uploaded Excel training register |
| POST | `/api/stt-training-report/export-pdf` | Generate PDF from Excel + save to document library |
| GET | `/api/quotation/abattoir-details?name=X` | Fetch abattoir details for quotation auto-fill |
| POST | `/api/quotation/generate` | Generate quotation PDF from template (no save) |
| POST | `/api/quotation/send` | Email quotation PDF + save to document library |
| GET/PUT | `/api/user-prefs?page=X&userId=Y` | Column visibility + order preferences |
| GET | `/api/documents/tree` | Document library folder/file tree |
| GET | `/api/documents/view?p=path` | View PDF inline or download file |
| DELETE | `/api/documents/delete?p=path` | Delete a document |
| GET | `/api/users` | List all users (admin) |
| PUT | `/api/users/:id/role` | Change user role (admin) |
| PUT | `/api/users/:id/permissions` | Update user page permissions (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |
| POST | `/api/users/invite` | Send invitation email (admin) |
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
npm run build
```

Creates a `dist/` folder. The Express server serves `dist/` automatically when `NODE_ENV=production`:

```bash
NODE_ENV=production node server/index.js
```

---

## Default Admin Account

On first startup, a default admin user is created:

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
| Backend | Express.js | 4.18 |
| Database | SQL Server (mssql) | 9.0 |
| Excel | ExcelJS | 4.4 |
| PDF | jsPDF + html2canvas | 4.2 / 1.4 |
| Email | Microsoft Graph API | - |
| Auth | JWT (custom) | - |

---

## Troubleshooting

### Database connection fails
- Ensure SQL Server is running and accepting TCP/IP connections on port 1433
- Open SQL Server Configuration Manager and enable TCP/IP protocol
- Check `DB_USER` and `DB_PASSWORD` in `.env`
- SQL Server must have **SQL Server Authentication** enabled (mixed mode, not just Windows Auth)
- Run `npm run test:db` to diagnose connection issues

### Tables not created
- Check server startup logs for migration errors
- The `initDb()` function in `server/db.js` creates all tables with `IF NOT EXISTS` guards
- If a table is corrupted, you can drop it manually and restart the server

### Email sending fails
- Verify all 4 `GRAPH_*` variables in `.env`
- Ensure the Azure AD app has **application permissions** (not delegated) for `Mail.Send`
- **Admin consent** must be granted in Azure portal
- The `GRAPH_SENDER_EMAIL` must be a valid mailbox in the tenant

### PDF conversion fails
- PDF conversion uploads an Excel file to the sender's OneDrive, renders it as PDF, then deletes it
- Requires `Files.ReadWrite.All` application permission
- The sender email account needs a **OneDrive/SharePoint license**
- Check server logs for specific Graph API error messages

### Vite proxy errors / CORS issues
- Ensure the backend is running on port 4000 **before** starting the frontend
- Use `npm start` to run both concurrently (recommended)
- The proxy config in `vite.config.js` forwards all `/api/*` requests to `http://localhost:4000`

### Excel import fails
- Ensure the Excel file follows the expected column layout
- Check browser console for parse errors
- The server uses ExcelJS to read `.xlsx` files (`.xls` not supported)
