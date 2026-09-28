# Wordsmith: Sentence Garden

A small sentence-building app. Choose a word category, get prefix suggestions while typing, assemble and reorder words, then save and edit sentences. New words are added to the selected category when their sentence is saved; suggestions prioritize words used more often.

## Stack

- Angular 18 standalone frontend, Angular Material, signals, and `HttpClient`
- Node.js with Express 4 and TypeScript
- PostgreSQL 16, accessed with `pg`
- Docker Compose for the local database

## Requirements

- Node.js 20.11+ (Node 24 works with the pinned Angular 18 CLI)
- Docker Desktop with Compose

## Run the full app with Docker

Start Docker Desktop, open a terminal in the repository root, and run:

```powershell
docker compose up --build
```

Compose builds and runs PostgreSQL, the Express API, and the Angular app served by Nginx. The API waits for the database, initializes the schema, and seeds the starter vocabulary before becoming healthy. The frontend waits for the API and proxies `/api` requests internally.

- App: `http://localhost:4201`
- API health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`

- The live and deployed web app: `https://clint-sentence-web-2026-ana0gpdehthue3g0.southafricanorth-01.azurewebsites.net/`

The Compose frontend and API use host ports `4201` and `3001` so they can run alongside the local development servers on `4200` and `3000`. The frontend calls the API through its internal `/api` proxy.

Stop the containers with `Ctrl+C`, or run `docker compose down` in another terminal. The database volume is preserved. Use `docker compose down -v` only if you intentionally want to delete the local database data. See live service output with `docker compose logs -f`.

## Run services separately for development

Start the database from the repository root with `docker compose up -d db`. In one terminal, run the API from `server/` with `npm install`, `npm run build`, `npm run seed`, and `npm start`. In another terminal, run the Angular dev server from `client/` with `npm install` and `npm start`; the dev-server proxy forwards `/api` to the local API.

## REST API

| Method | Route                       | Purpose                              |
| ------ | --------------------------- | ------------------------------------ |
| GET    | `/api/word-types`           | List word types                      |
| GET    | `/api/word-types/:id/words` | List words for a type                |
| GET    | `/api/word-types/:id/words/suggestions?q=pre` | Return prefix matches ranked by usage |
| POST   | `/api/word-types/:id/words` | Add a word to a type's library       |
| POST   | `/api/sentences`            | Save ordered typed words and the sentence; learn new words |
| GET    | `/api/sentences`            | List saved sentences                 |
| GET    | `/api/sentences/:id`        | Retrieve a sentence                  |
| PUT    | `/api/sentences/:id`        | Update a sentence                    |

## Checks

```powershell
cd client; npm run build
cd ..\server; npm run build
//////

