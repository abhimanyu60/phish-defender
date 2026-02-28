# PhishDefender

An open-source phishing and spam email analysis platform. PhishDefender connects to Microsoft 365 shared mailboxes via the Microsoft Graph API, automatically classifies incoming emails for phishing threats, and provides a dashboard for security analysts to review, override, and audit decisions.

---

## Features

- **Automated ingestion** — polls Microsoft 365 shared mailboxes via Graph API delta queries
- **Heuristic classification** — scores emails on suspicious keywords, spoofed domains, mismatched links, urgency cues, and more
- **Analyst dashboard** — review queue, threat indicators, confidence scores, and full email body preview
- **Manual override** — analysts can promote/demote classifications and leave notes; every action is audit-logged
- **Bulk review** — mark multiple emails at once as safe or phishing
- **Analytics** — accuracy trends, top phishing domains, keyword frequency, analyst activity charts
- **Configurable rules** — add custom detection rules per keyword or regex pattern via the Settings UI
- **CSV export** — export email list or audit log to CSV at any time
- **Scheduled ingestion** — background APScheduler job with pause/resume/trigger controls

---

## Architecture

```
 Microsoft 365 Mailbox
        |
        v  (Graph API delta query)
 ┌─────────────────────┐
 │   FastAPI Backend   │
 │  (Python / async)   │
 │                     │
 │  APScheduler job    │──> SimpleClassifier ──> PostgreSQL
 │  REST API (port 8000│
 └─────────────────────┘
        |
        v  (fetch / JSON)
 ┌─────────────────────┐
 │  React Frontend     │
 │  (Vite + TypeScript)│
 │  (port 8080)        │
 └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| ORM | SQLAlchemy 2 (async) + Alembic |
| Database | PostgreSQL 15+ |
| Graph API auth | MSAL (Microsoft Authentication Library) |
| Scheduler | APScheduler 3 |
| HTTP client | httpx (async) |
| Config | pydantic-settings |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+ running locally (or a connection string to a remote instance)
- (Optional) Azure App Registration for live Graph API ingestion

### 1. Clone

```bash
git clone https://github.com/abhimanyu60/phish-defender.git
cd phish-defender
```

### 2. Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables to set (see [Configuration](#configuration) for the full list):

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/phishdefender
DATABASE_SYNC_URL=postgresql+psycopg2://user:password@localhost:5432/phishdefender
```

Run database migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

From the project root:

```bash
npm install
```

Create a `.env.local` file in the project root:

```env
VITE_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

The UI will be available at `http://localhost:8080`.

### 4. Azure App Registration (optional — for live email ingestion)

1. Go to [Azure Portal](https://portal.azure.com) > **Azure Active Directory** > **App registrations** > **New registration**.
2. Give it a name (e.g. `PhishDefender`), select **Accounts in this organizational directory only**, click **Register**.
3. Under **API permissions** add:
   - `Mail.Read` (Application permission)
   - `Mail.ReadWrite` (Application permission, needed for marking as read)
   - Grant admin consent.
4. Under **Certificates & secrets** create a new client secret. Copy the value immediately.
5. Note your **Application (client) ID** and **Directory (tenant) ID** from the Overview page.
6. Add to `backend/.env`:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
MAILBOX_ADDRESSES=shared-mailbox@yourdomain.com
```

The ingestion job will start automatically when the backend starts and Graph API credentials are present.

---

## Configuration

All backend configuration is in `backend/.env` (copy from `backend/.env.example`).

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Async PostgreSQL URL (`postgresql+asyncpg://...`) |
| `DATABASE_SYNC_URL` | — | Sync PostgreSQL URL for Alembic (`postgresql+psycopg2://...`) |
| `AZURE_TENANT_ID` | — | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | — | Azure app client ID |
| `AZURE_CLIENT_SECRET` | — | Azure app client secret |
| `MAILBOX_ADDRESSES` | — | Comma-separated list of shared mailbox addresses to poll |
| `INGESTION_POLL_INTERVAL` | `300` | Seconds between ingestion runs |
| `PHISHING_THRESHOLD` | `0.6` | Score threshold above which an email is classified as phishing |
| `SUSPICIOUS_THRESHOLD` | `0.3` | Score threshold above which an email is classified as suspicious |
| `SECRET_KEY` | — | App secret key (for future auth use) |
| `ALLOWED_ORIGINS` | `http://localhost:8080` | CORS allowed origins |

---

## API Reference

Base URL: `http://localhost:8000`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/dashboard/summary` | Dashboard stats (counts, recent activity, ingestion status) |
| `GET` | `/api/emails` | Paginated email list (filter by category, search, date range) |
| `GET` | `/api/emails/{id}` | Full email detail with threat indicators |
| `POST` | `/api/emails/{id}/override` | Override classification for one email |
| `POST` | `/api/emails/bulk-review` | Bulk override for multiple emails |
| `GET` | `/api/emails/export/csv` | Download email list as CSV |
| `GET` | `/api/analytics/accuracy` | Classifier accuracy stats |
| `GET` | `/api/analytics/category-trend` | Daily category counts (last N days) |
| `GET` | `/api/analytics/top-domains` | Top phishing sender domains |
| `GET` | `/api/analytics/keywords` | Top phishing keyword hits |
| `GET` | `/api/analytics/analyst-activity` | Per-analyst override counts |
| `GET` | `/api/audit-log` | Paginated audit log |
| `GET` | `/api/audit-log/export/csv` | Download audit log as CSV |
| `GET` | `/api/settings` | Get current settings |
| `PATCH` | `/api/settings/thresholds` | Update classification thresholds |
| `PATCH` | `/api/settings/notifications` | Update notification settings |
| `POST` | `/api/settings/job/pause` | Pause the ingestion job |
| `POST` | `/api/settings/job/resume` | Resume the ingestion job |
| `POST` | `/api/settings/job/trigger` | Trigger an immediate ingestion run |
| `GET` | `/api/settings/rules` | List custom detection rules |
| `POST` | `/api/settings/rules` | Create a custom rule |
| `DELETE` | `/api/settings/rules/{id}` | Delete a custom rule |
| `GET` | `/api/settings/mailboxes` | List monitored mailboxes |

---

## Project Structure

```
phish-defender/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # App factory, lifespan, routers
│   │   ├── config.py           # pydantic-settings configuration
│   │   ├── database.py         # Async SQLAlchemy engine + session
│   │   ├── models/             # ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # FastAPI route handlers
│   │   ├── services/           # Business logic (Graph API, ingestion, analytics)
│   │   └── jobs/               # APScheduler background job
│   ├── alembic/                # Database migrations
│   ├── requirements.txt
│   └── .env.example
├── src/                        # React frontend (TypeScript)
│   ├── components/             # UI components
│   ├── pages/                  # Page components
│   ├── services/
│   │   └── api.ts              # All backend API calls
│   └── ...
├── public/
├── index.html
├── package.json
└── vite.config.ts
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to abide by its terms.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
