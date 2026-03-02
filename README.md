# 🗂️ Project Management System (PMS)

Sistem informatic web pentru generarea de rapoarte și administrarea proiectelor din cadrul unei organizații.

## 🌐 Demo Live (Railway)

Aplicația este deployată pe [Railway](https://railway.app) și accesibilă public:

| Serviciu | URL |
|----------|-----|
| **Frontend** | [https://project-management-system-production-1fa2.up.railway.app](https://project-management-system-production-1fa2.up.railway.app) |
| **Backend API** | [https://project-management-system-production-e19f.up.railway.app/api](https://project-management-system-production-e19f.up.railway.app/api) |
| **Health Check** | [https://project-management-system-production-e19f.up.railway.app/api/health](https://project-management-system-production-e19f.up.railway.app/api/health) |

### Infrastructură Railway

| Serviciu | Tehnologie | Detalii |
|----------|-----------|---------|
| **PMS - Frontend** | Docker + nginx 1.29.5 | Port 8081, regiune EU |
| **PMS - Backend** | Docker + Node.js 20 | Port 8080, regiune EU |
| **Postgres** | Railway PostgreSQL | Volum persistent |
| **MongoDB** | Railway MongoDB | Volum persistent |

### Note deployment
- **Primul utilizator** înregistrat în aplicație primește automat rolul de `admin`
- Variabilele de mediu sunt configurate în Railway Dashboard → fiecare serviciu → Variables
- Build-ul frontend-ului primește `VITE_API_URL` ca Docker build argument (bake-uit la compile time de Vite)
- Backend-ul suportă atât `DATABASE_URL` (Railway) cât și variabile individuale `POSTGRES_*` (local Docker Compose)

---

## Tech Stack

| Categorie | Tehnologie |
|-----------|-----------|
| **Frontend** | React + TypeScript + Tailwind CSS + Vite |
| **Backend** | Node.js + Express.js + TypeScript |
| **DB SQL** | PostgreSQL 16 (utilizatori, autentificare, notificări, setări, audit) |
| **DB NoSQL** | MongoDB 7 (proiecte, sarcini, comentarii, atașamente) |
| **Autentificare** | JWT + bcrypt + RBAC + TOTP MFA (admin) |
| **Containerizare** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |
| **Security** | Helmet, rate-limit, CodeQL, npm audit |

## Structura proiectului

```
├── .github/workflows/ci-cd.yml   # Pipeline CI/CD
├── backend/
│   ├── src/
│   │   ├── __tests__/             # Suite de teste
│   │   │   ├── helpers/           # testApp.ts, authHelper.ts
│   │   │   ├── middleware/        # auth.test.ts, rbac.test.ts, errorHandler.test.ts
│   │   │   ├── controllers/       # auth.controller.test.ts
│   │   │   └── integration/       # auth.routes.test.ts, project.routes.test.ts, task.routes.test.ts
│   │   ├── config/                # Conexiuni PostgreSQL & MongoDB
│   │   ├── controllers/           # Logica endpoint-urilor
│   │   ├── middleware/            # Auth JWT, RBAC, error handler
│   │   ├── models/                # Mongoose models (Project, Task)
│   │   ├── routes/                # Express routes
│   │   ├── types/                 # TypeScript interfaces
│   │   └── index.ts               # Entry point server
│   ├── uploads/                   # Atașamente uploadate la sarcini
│   ├── jest.config.js             # Configurare Jest (doar backend)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── __tests__/             # Teste frontend (rulate prin Vitest)
│   │   │   ├── utils/             # timeAgo.test.ts
│   │   │   └── context/           # AuthContext.test.ts
│   │   ├── components/            # Componente reutilizabile (Layout)
│   │   ├── context/               # AuthContext (React Context)
│   │   ├── pages/                 # Pagini aplicație
│   │   ├── services/              # Axios API client
│   │   └── styles/                # Tailwind CSS
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Pasul 1: Clonare & configurare

```bash
git clone https://github.com/CristianMusatZ/project-management-system.git
cd project-management-system
cp .env.example .env
```

### Pasul 2: Pornire cu Docker Compose

```bash
docker-compose up --build
```

Asta pornește automat:
- 🐘 **PostgreSQL** pe `localhost:5432`
- 🍃 **MongoDB** pe `localhost:27017`
- 🔧 **Backend API** pe `http://localhost:4000`
- 🌐 **Frontend** pe `http://localhost:3000`

### Pasul 3: Verificare

- Frontend: [http://localhost:3000](http://localhost:3000)
- API Health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## ✅ Funcționalități implementate

### Autentificare & Cont
- Înregistrare și autentificare cu JWT
- **Confirmare email la înregistrare** — dacă SMTP e configurat, contul este inactiv până la click pe link-ul trimis pe email (expiră în 24h); dacă SMTP nu e configurat, contul se activează automat (graceful degradation)
- Pagina de profil (editare nume, schimbare parolă)
- **Recuperare parolă** — flow complet cu token securizat (expiră în 1h); în development link-ul de resetare este returnat direct în răspunsul API

### Gestionare utilizatori (Admin)
- Listare, creare utilizatori noi cu rol ales
- Activare / dezactivare conturi
- Schimbare rol

### Proiecte
- Creare, editare, ștergere proiecte
- Alocare membri la proiecte (Admin / Project Manager)
- Filtrare și vizualizare per status

### Sarcini — Kanban Board
- Board Kanban cu 4 coloane: De făcut / În lucru / În review / Finalizat
- Drag & Drop între coloane
- Creare și editare sarcini cu titlu, descriere, prioritate, deadline, status
- Asignare sarcini la membri ai proiectului
- Comentarii pe sarcini
- **Atașamente** — upload fișiere (max 10 MB), descărcare și ștergere direct din cardul sarcinii

### Notificări în timp real + Email
- Notificări automate la: asignare sarcină, schimbare status, comentariu nou
- Clopoțel în sidebar cu badge număr necitite
- Dropdown cu ultimele 30 de notificări, polling la 30 secunde
- Marcare citite individual sau toate odată
- **Email notifications** — la fiecare notificare se trimite și un email HTML (template dedicat per tip: asignare, status, comentariu); trimitere prin **Brevo API** (serviciu tranzacțional); graceful degradation — dacă `BREVO_API_KEY` nu e configurat, notificările in-app funcționează normal
  > ⚠️ **Notă:** Emailurile pot ajunge în folderul **Spam / Junk** dacă nu este configurat un domeniu custom verificat. Verificați spam dacă nu găsiți emailul în inbox.

### Rapoarte
- Export PDF și Excel
- Statistici generale: total sarcini, finalizate, în lucru, critice
- Statistici per utilizator: sarcini alocate, finalizate, rată de finalizare

### Dashboard cu Grafice
- Statistici generale (4 carduri: total sarcini, finalizate, în lucru, proiecte active)
- Donut chart SVG — distribuția sarcinilor pe status (fără librării externe)
- Horizontal bar chart — distribuția pe prioritate
- Timeline Gantt — proiecte cu date de start/end și marcaj „azi"
- Liste rapide: sarcini recente + proiecte cu depășire termen

### Categorii / Etichete
- Creare și gestionare etichete cu nume + culoare hex (admin)
- Asociere etichete la proiecte și sarcini (multi-select)
- Badge-uri colorate pe carduri; picker de etichete în modalele de creare/editare

### Autentificare Multi-Factor (MFA) — Admin
- Activare/dezactivare 2FA TOTP exclusiv pentru contul de admin
- Flow de setup: generare secret → scanare QR code cu Google Authenticator / Authy → confirmare cod
- Login în 2 pași: parolă → cod TOTP de 6 cifre (fereastră ±30 s)
- Implementare RFC 6238 nativă — fără dependențe externe (built-in `crypto`)

### Setări & Audit (Admin)
- Setări generale organizație (nume firmă)
- **Logo organizație** — upload imagine (PNG/JPG/SVG/WebP, max 2 MB), preview în timp real, stocat în baza de date; afișat în interfață
- Jurnal de activitate paginat cu filtre pe acțiune și utilizator
- Gestionare etichete globale (CRUD complet cu cascade delete)

## 📡 API Endpoints

### Auth
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| POST | `/api/auth/register` | Înregistrare cont |
| POST | `/api/auth/login` | Autentificare |
| GET | `/api/auth/verify-email` | Confirmare cont prin link email |
| POST | `/api/auth/forgot-password` | Solicitare resetare parolă |
| POST | `/api/auth/reset-password` | Resetare parolă cu token |
| GET | `/api/auth/profile` | Profil utilizator 🔒 |
| PUT | `/api/auth/profile` | Actualizare profil 🔒 |
| PUT | `/api/auth/change-password` | Schimbare parolă 🔒 |

### Users
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/users` | Lista utilizatori 🔒 |
| GET | `/api/users/list` | Lista simplificată (toate rolurile) 🔒 |
| POST | `/api/users` | Creare utilizator (Admin) 🔒 |
| GET | `/api/users/:id` | Detalii utilizator 🔒 |
| PATCH | `/api/users/:id/role` | Schimbare rol (Admin) 🔒 |
| PATCH | `/api/users/:id/toggle-active` | Activare/dezactivare (Admin) 🔒 |

### Projects
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/projects` | Lista proiecte 🔒 |
| GET | `/api/projects/:id` | Detalii proiect 🔒 |
| POST | `/api/projects` | Creare proiect 🔒 |
| PUT | `/api/projects/:id` | Editare proiect 🔒 |
| DELETE | `/api/projects/:id` | Ștergere proiect 🔒 |
| POST | `/api/projects/:id/members` | Adăugare membru 🔒 |
| DELETE | `/api/projects/:id/members/:userId` | Eliminare membru 🔒 |

### Tasks
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| POST | `/api/tasks` | Creare sarcină 🔒 |
| GET | `/api/tasks/all` | Toate sarcinile 🔒 |
| GET | `/api/tasks/project/:projectId` | Sarcini per proiect 🔒 |
| GET | `/api/tasks/:id` | Detalii sarcină 🔒 |
| PUT | `/api/tasks/:id` | Editare sarcină 🔒 |
| DELETE | `/api/tasks/:id` | Ștergere sarcină 🔒 |
| POST | `/api/tasks/:id/comments` | Adăugare comentariu 🔒 |
| POST | `/api/tasks/:id/attachments` | Upload atașament 🔒 |
| DELETE | `/api/tasks/:id/attachments/:filename` | Ștergere atașament 🔒 |

### Notifications
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/notifications` | Lista notificări 🔒 |
| PUT | `/api/notifications/read-all` | Marcare toate citite 🔒 |
| PUT | `/api/notifications/:id/read` | Marcare citită 🔒 |

### Settings (Admin)
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/settings` | Setări sistem 🔒 |
| PUT | `/api/settings` | Actualizare setări (Admin) 🔒 |
| PUT | `/api/settings/logo` | Upload logo organizație (Admin) 🔒 |
| DELETE | `/api/settings/logo` | Ștergere logo (Admin) 🔒 |
| GET | `/api/settings/audit-logs` | Jurnal activitate (Admin) 🔒 |
| GET | `/api/settings/audit-logs/actions` | Tipuri acțiuni audit (Admin) 🔒 |

### Labels
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/labels` | Lista etichete 🔒 |
| POST | `/api/labels` | Creare etichetă (Admin) 🔒 |
| PUT | `/api/labels/:id` | Editare etichetă (Admin) 🔒 |
| DELETE | `/api/labels/:id` | Ștergere etichetă + cascade (Admin) 🔒 |

### MFA (Admin only)
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/mfa/status` | Status MFA activ/inactiv 🔒 |
| GET | `/api/mfa/setup` | Generare secret + URI QR code 🔒 |
| POST | `/api/mfa/enable` | Activare MFA (confirmare cod TOTP) 🔒 |
| POST | `/api/mfa/disable` | Dezactivare MFA (confirmare cod TOTP) 🔒 |
| POST | `/api/mfa/verify` | Validare cod TOTP la login (step 2) 🔒 |

### Uploads
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/uploads/:filename` | Descărcare fișier atașat |

🔒 = necesită Bearer Token (JWT)

## Roluri utilizatori (RBAC)

| Rol | Descriere |
|-----|-----------|
| `admin` | Acces complet la toate funcționalitățile |
| `project_manager` | Gestionare proiecte proprii, alocare membri, creare sarcini |
| `member` | Lucru pe sarcini alocate, comentarii, atașamente |
| `viewer` | Vizualizare read-only |

## Scheme baze de date

### PostgreSQL
- `users` — conturi, parole hash, roluri
- `sessions` — tokeni refresh
- `audit_logs` — jurnal toate acțiunile
- `notifications` — notificări per utilizator
- `settings` — setări cheie-valoare
- `password_reset_tokens` — tokeni resetare parolă (expiră în 1h)
- `users.mfa_secret` — secret TOTP criptat (coloană adăugată non-destructiv)
- `users.mfa_enabled` — flag activare MFA per utilizator

### MongoDB
- `projects` — proiecte cu membri, metadate și etichete asociate
- `tasks` — sarcini cu comentarii, atașamente (subdocumente) și etichete asociate
- `labels` — etichete globale (nume, culoare hex, creat de)

### Brevo (Email Notifications)
Emailurile tranzacționale sunt trimise prin [Brevo](https://brevo.com) (ex-Sendinblue) via REST API. Dacă variabilele nu sunt setate, emailurile sunt dezactivate fără erori (graceful degradation).

| Variabilă | Descriere | Exemplu |
|-----------|-----------|---------|
| `BREVO_API_KEY` | API Key din dashboard Brevo | `xkeysib-...` |
| `BREVO_FROM` | Adresă expeditor verificată în Brevo | `noreply@firma.ro` |
| `BREVO_FROM_NAME` | Nume expeditor (opțional) | `Project Management System` |

**Setup:**
1. Creează cont gratuit pe [brevo.com](https://brevo.com) (300 emailuri/zi gratuit)
2. Verifică adresa de expeditor: **Settings → Senders & IP → Add a Sender**
3. Generează API key: **Settings → API Keys**
4. Adaugă variabilele în Railway Dashboard → serviciul backend → Variables

> ⚠️ **Notă:** Fără un domeniu custom verificat, emailurile pot ajunge în folderul **Spam / Junk**. Verificați spam dacă nu găsiți emailul în inbox.

## 🔒 Securitate

### Scanare automată (GitHub Actions)
| Tool | Tip | Trigger |
|------|-----|---------|
| **CodeQL** | SAST — analiză statică cod | PR + push + luni la 07:00 |
| **Snyk** | SCA + SAST — vulnerabilități dependențe | PR + push + luni la 07:00 |
| **npm audit** | SCA — audit dependențe NPM | PR + push |
| **Dependabot** | Auto-PR pentru update-uri dependențe | Luni la 08:00 (Bucharest) |

### Configurare Snyk
1. Creează cont gratuit pe [snyk.io](https://snyk.io)
2. Copiază token-ul din **Account Settings → Auth Token**
3. Adaugă în GitHub → **Settings → Secrets → Actions**: `SNYK_TOKEN`

Fără `SNYK_TOKEN`, job-ul Snyk folosește `continue-on-error: true` — nu blochează pipeline-ul.

### Rapoarte securitate
- Rezultatele CodeQL apar în GitHub → **Security → Code scanning alerts**
- Rapoartele Snyk apar în dashboard-ul **snyk.io**
- Rapoartele npm audit sunt salvate ca **GitHub Actions Artifacts** (retenție 90 zile)

## 🧪 Testare

### Stack de testare

| Strat | Tool | Scop |
|-------|------|------|
| **Backend — unitar** | Jest 29 + ts-jest | Testare izolată a middleware-urilor și controller-elor, cu baza de date mockuită |
| **Backend — integrare** | Supertest | Cereri HTTP reale trimise la aplicație, fără server pornit separat |
| **Frontend** | Vitest 2 | Testare logică pură (localStorage, RBAC, utilități) cu `globals: true` |

---

### Ce este acoperit

#### Teste unitare middleware (`src/__tests__/middleware/`)

**`auth.test.ts`** — 10 teste pentru `authenticate()` și `generateToken()`
- Respinge cereri fără header `Authorization`
- Respinge token-uri cu format greșit (fără prefix `Bearer`)
- Respinge token-uri invalide sau semnate cu alt secret
- Respinge token-uri expirate
- Setează corect `req.user` pentru token-uri valide
- Verifică durata de expirare: 24h pentru login normal, 5 minute pentru pasul MFA

**`rbac.test.ts`** — 8 teste pentru `authorize()`
- Returnează 401 dacă utilizatorul nu e autentificat
- Returnează 403 dacă rolul nu se află în lista de roluri permise
- Apelează `next()` când rolul este permis
- Suportă liste cu roluri multiple

**`errorHandler.test.ts`** — 5 teste pentru middleware-ul global de erori
- `ValidationError` → 400
- `UnauthorizedError` → 401
- Erori generice → 500 cu mesaj detaliat în development
- Erori generice → 500 cu mesaj generic în production

#### Teste unitare controller (`src/__tests__/controllers/`)

**`auth.controller.test.ts`** — 25+ teste cu PostgreSQL, bcrypt și email service mockuite
- `register`: câmpuri lipsă, parolă prea scurtă, email deja existent, primul utilizator devine admin, al doilea devine member, flow cu confirmare email (SMTP activ vs. graceful degradation)
- `login`: câmpuri lipsă, utilizator inexistent, parolă greșită, login reușit, flow MFA (răspuns cu `requiresMFA` + `tempToken`)
- `getProfile`: utilizator găsit / negăsit
- `changePassword`: parolă curentă greșită
- `forgotPassword`: comportament anti-enumerare (răspuns identic indiferent dacă emailul există sau nu)
- `resetPassword`: token invalid, token expirat, resetare reușită

#### Teste de integrare HTTP (`src/__tests__/integration/`)

Testele pornesc aplicația Express complet (fără server real), folosind `testApp.ts` — fără conexiuni reale la PostgreSQL sau MongoDB.

**`auth.routes.test.ts`** — acoperă toate rutele `/api/auth/*`

**`project.routes.test.ts`** — acoperă `/api/projects/*`
- `GET /` — 401 fără token, admin vede toate proiectele, member/viewer vede doar proiectele din care face parte, filtrare pe status
- `POST /` — 403 pentru member și viewer, 400 câmpuri lipsă, 201 creare reușită (admin și PM)
- `GET /:id` — 404 inexistent, 403 member care nu e în proiect, 200 admin sau member din proiect
- `PUT /:id` — 403 member, 404, 403 PM pe proiectul altcuiva, 200 admin
- `DELETE /:id` — 403 member și PM pe proiect strain, 200 admin

**`task.routes.test.ts`** — acoperă `/api/tasks/*`
- `GET /all` — 401, admin vede tot, member vede doar sarcinile din proiectele lui
- `GET /project/:id` — lista sarcini, filtrare pe status
- `POST /` — 403 viewer, 403 member (nu e în proiect), 400 titlu lipsă, 201 creare reușită
- `PUT /:id` — 403 viewer, 403 member pe sarcina altcuiva, 200 member pe propria sarcină, 200 admin
- `DELETE /:id` — 403 member și viewer, 200 admin
- `POST /:id/comments` — 403 viewer, 400 fără text, 404, 200 admin

#### Teste frontend (`frontend/src/__tests__/`)

**`utils/timeAgo.test.ts`** — 11 teste pentru funcția de formatare timp relativ
- "acum" (sub 1 minut)
- "acum X min" (între 1 și 59 minute)
- "acum Xh" (între 1 și 23 ore)
- "acum Xz" (peste 24 ore)

**`context/AuthContext.test.ts`** — 18 teste pentru logica din AuthContext
- Salvare token și user în localStorage la login
- Ștergere la logout
- Merge la `updateUser` (modificare parțială a profilului)
- Restaurare sesiune la reîncărcarea paginii (token existent)
- Comportament când localStorage e gol
- Fluxul MFA: nu se salvează token final dacă API returnează `requiresMFA`
- Fluxul de verificare email: nu se salvează token dacă `requiresEmailVerification`
- Logica RBAC — `canExport`: admin ✅ / project_manager ✅ / viewer ✅ / member ❌
- Vizibilitate nav items per rol

---

### Cum rulezi testele

**Backend** (Jest + ts-jest + Supertest):

```bash
cd backend
npm test
```

Rezultat așteptat:

```
Test Suites: 7 passed, 7 total
Tests:       124 passed, 124 total
```

**Frontend** (Vitest):

```bash
cd frontend
npm test
```

Rezultat așteptat:

```
Test Files  2 passed (2)
Tests       29 passed (29)
```

#### Rulare selectivă (backend)

```bash
# Doar testele de middleware
npm test -- middleware

# Doar testele de integrare
npm test -- integration

# Doar testele pentru un fișier specific
npm test -- auth.routes

# Watch mode (re-rulează automat la modificări)
npm test -- --watch

# Cu raport de acoperire (coverage)
npm test -- --coverage
```

---

### Când să rulezi testele

| Situație | Acțiune recomandată |
|----------|---------------------|
| Înainte de orice commit | `npm test` — dacă vreun test pică, nu faci commit |
| După modificarea unui controller | Rulezi testele unitare pentru controller-ul respectiv |
| După modificarea unui middleware | Rulezi `npm test -- middleware` |
| După modificarea logicii de autentificare | Rulezi `npm test -- auth` |
| La deschiderea unui Pull Request | Pipeline-ul CI rulează automat toate testele |

---

### Interpretarea output-ului

```
PASS src/__tests__/middleware/auth.test.ts       ← suite a trecut
FAIL src/__tests__/integration/auth.routes.test.ts  ← suite a picat

● POST /api/auth/login › returnează 401 la parolă greșită

  Expected: 401
  Received: 200                                  ← valoarea primită vs. așteptată
```

**`console.error` în output** — nu indică o problemă. Testele care verifică gestionarea erorilor (ex. DB inaccesibil) declanșează intenționat ramura `catch` din controller, care loghează eroarea — exact cum ar face în producție. Testul verifică apoi că răspunsul HTTP este 500.

---

## Comenzi utile

```bash
# Pornire
docker-compose up --build

# Oprire
docker-compose down

# Oprire + ștergere volume (resetează bazele de date)
docker-compose down -v

# Doar backend (development fără Docker)
cd backend && npm install && npm run dev

# Doar frontend (development fără Docker)
cd frontend && npm install && npm run dev

# Rulare teste
cd backend && npm test
```
