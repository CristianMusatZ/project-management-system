# 🗂️ Project Management System (PMS)

Sistem informatic (web și desktop) pentru generarea de rapoarte și administrarea proiectelor din cadrul unei organizații.

## Tech Stack

| Categorie | Tehnologie |
|-----------|-----------|
| **Frontend Web** | React + TypeScript + Tailwind CSS + Vite |
| **Frontend Desktop** | Electron (etapă ulterioară) |
| **Backend** | Node.js + Express.js + TypeScript |
| **DB SQL** | PostgreSQL 16 (date sensibile, ACID) |
| **DB NoSQL** | MongoDB 7 (proiecte, sarcini, documente) |
| **Autentificare** | JWT + bcrypt + RBAC |
| **Containerizare** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |
| **Security** | Helmet, rate-limit, CodeQL, npm audit |

## Structura proiectului

```
├── .github/workflows/ci-cd.yml   # Pipeline CI/CD
├── backend/
│   ├── src/
│   │   ├── config/                # Conexiuni PostgreSQL & MongoDB
│   │   ├── controllers/           # Logica endpoint-urilor
│   │   ├── middleware/            # Auth JWT, RBAC, error handler
│   │   ├── models/                # Mongoose models (Project, Task)
│   │   ├── routes/                # Express routes
│   │   ├── types/                 # TypeScript interfaces
│   │   └── index.ts               # Entry point server
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/            # Componente reutilizabile
│   │   ├── context/               # AuthContext (React Context)
│   │   ├── pages/                 # Pagini (Login, Dashboard, etc.)
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
git clone https://github.com/UTILIZATORUL_TAU/project-management-system.git
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

## 📡 API Endpoints

### Auth
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| POST | `/api/auth/register` | Înregistrare cont |
| POST | `/api/auth/login` | Autentificare |
| GET | `/api/auth/profile` | Profil utilizator 🔒 |

### Users (Admin only)
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/users` | Lista utilizatori 🔒 |
| GET | `/api/users/:id` | Detalii utilizator 🔒 |
| PATCH | `/api/users/:id/role` | Schimbare rol 🔒 |
| PATCH | `/api/users/:id/toggle-active` | Activare/dezactivare 🔒 |

### Projects
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `/api/projects` | Lista proiecte 🔒 |
| GET | `/api/projects/:id` | Detalii proiect 🔒 |
| POST | `/api/projects` | Creare proiect 🔒 |
| PUT | `/api/projects/:id` | Editare proiect 🔒 |
| DELETE | `/api/projects/:id` | Ștergere proiect 🔒 |

### Tasks
| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| POST | `/api/tasks` | Creare sarcină 🔒 |
| GET | `/api/tasks/project/:projectId` | Sarcini per proiect 🔒 |
| GET | `/api/tasks/:id` | Detalii sarcină 🔒 |
| PUT | `/api/tasks/:id` | Editare sarcină 🔒 |
| DELETE | `/api/tasks/:id` | Ștergere sarcină 🔒 |
| POST | `/api/tasks/:id/comments` | Adăugare comentariu 🔒 |

🔒 = necesită Bearer Token (JWT)

## Roluri utilizatori (RBAC)

| Rol | Descriere |
|-----|-----------|
| `admin` | Acces complet |
| `project_manager` | Gestionare proiecte proprii |
| `member` | Lucru pe sarcini alocate |
| `viewer` | Vizualizare read-only |

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
```
