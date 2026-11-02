# Hackops-CR API

FastAPI backend for the consumer workspace. It provides private workspaces, persistent case and warranty records, private evidence uploads, contract screening with exact-sentence retrieval, and product-source lookups. OpenAPI docs are served at `/docs`.

## Run locally

Requires Python 3.11 or newer. From the repository root:

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[ocr]'
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The default local database and evidence files are stored in `backend/data/`. Start Redis and run the worker and scheduler if you want expiry reminders:

```sh
celery -A app.tasks.celery_app:celery_app worker --loglevel=info
celery -A app.tasks.celery_app:celery_app beat --loglevel=info
```

The simplest complete local stack is `docker compose up --build` from the repository root. It starts the API, PostgreSQL, Redis, a Celery worker, and Celery Beat. The default database password in Compose is for local development only. Set a strong `POSTGRES_PASSWORD`, matching `DATABASE_URL`, and a restricted `CORS_ORIGINS` before exposing the service.

## First API call

Create a private workspace once and store the returned bearer token in the client. The API stores only a SHA-256 digest of this high-entropy token; it cannot be recovered. Losing it means creating a new workspace. The browser connector stores this local single-device credential in localStorage; it is not an account or protection from same-origin script access.

```sh
curl -X POST http://127.0.0.1:8000/api/v1/workspaces
```

Use the returned `access_token` on all workspace data calls:

```sh
curl http://127.0.0.1:8000/api/v1/workspace/snapshot \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

The API is stateless apart from the database, uploaded-file volume, and Redis task queue. All case, warranty, contract, evidence, and notification reads are scoped to the bearer-token workspace. `DELETE /api/v1/workspaces/me` permanently deletes that workspace and its stored files.

## API map

| Route | Purpose |
| --- | --- |
| `POST /api/v1/workspaces` | Create a workspace and one-time bearer token |
| `GET /api/v1/workspace/snapshot` | Load cases, warranty items, and recent activity |
| `POST /api/v1/cases/intake` | Save facts, an arithmetic estimate, and a reviewable Markdown draft |
| `PATCH /api/v1/cases/{id}` | Record a user-entered sent date or mark resolved |
| `GET /api/v1/cases/{id}/notice.pdf` | Download a reviewable PDF draft |
| `POST /api/v1/warranty/items` | Create a warranty record |
| `POST /api/v1/warranty/ingest` | Store PDF/JPEG/PNG evidence and extract available text |
| `POST /api/v1/warranty/claim/generate` | Prepare an unsent warranty-service request |
| `POST /api/v1/warranty/claim/escalate` | Copy a warranty record and evidence into a new case |
| `POST /api/v1/contracts/audit` | Persist keyword screening and exact sentence IDs |
| `POST /api/v1/contracts/chat` | Retrieve matching sentences with verbatim citations |
| `POST /api/v1/scan/lookup` | Query public CPSC, openFDA, and Open Food Facts sources |
| `GET /api/v1/notifications` | Read scheduled warranty and response-date reminders |

Use the interactive docs at `/docs` for request bodies and response fields.

## Data and safety notes

- The browser UI remains local-first unless `NEXT_PUBLIC_BACKEND_URL` is set; then it syncs cases, warranty items and evidence, and uses the API for contract and barcode lookups.
- Case amounts are arithmetic estimates. Interest defaults to 0%; any entered rate is user-supplied and is never labeled a statutory rate. A recorded response period is optional and user-entered.
- Case notices and warranty requests are drafts. The API never sends letters, files claims, determines eligibility, or provides legal advice.
- Contract analysis is a transparent keyword screen. LexiBot retrieves exact stored sentences; it does not use an LLM or invent answers.
- Evidence is limited to PDF/JPEG/PNG and 10 MB by default. Files are stored outside the database and identified by SHA-256. PDF text extraction is best-effort; image OCR requires Tesseract and remains subject to consumer confirmation.
- Recall and product data are third-party records. No result means only that no matching record was returned; it is not a safety certification or proof that a product has no recall.
- Before public deployment, put the service behind HTTPS, rate-limit workspace creation at the proxy, restrict CORS, use managed secrets and database backups, and use Alembic migrations instead of `create_all` for schema changes.
