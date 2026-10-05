# TraumaSense AI Demo

A self-contained, responsive dashboard prototype for trauma-informed support intake and case triage.

## Run the full-stack demo locally

Requires Node.js 18 or later. From the project folder:

```powershell
npm start
```

Then visit <http://127.0.0.1:3000>. Set the `PORT` environment variable to use a different port. The Node.js backend serves the app and provides `GET /api/health`, `GET /api/cases`, and `POST /api/assessments`.

## Prototype capabilities

- Sample assessment dashboard with search and risk filters
- Consent-gated intake form, server-validated assessment input, and a transparent, heuristic-only demo score
- Human-reviewed support suggestions and CSV export
- Responsive layout and multilingual language selection

## Important limitations

This is a demo-only full-stack prototype, not a production service. Its sample cases and simple server-side scoring heuristic are not clinical assessments, validated AI, or suitable for real-world decisions. It does not analyze speech or audio or contact emergency services. The server binds to localhost and keeps newly submitted demo assessments in memory only; data is lost when the server restarts. Never enter real personal or case information. Production use would require security and privacy review, validated clinical oversight, secure infrastructure, accessibility and language testing, persistent-storage policies, and approved emergency-response procedures.
