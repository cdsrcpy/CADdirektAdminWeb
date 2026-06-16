# CADdirekt Admin Web

## 📖 Overview

**CADdirekt Admin Web** is a full‑stack administration tool for managing CADdirekt licenses, customers, resellers and subscription histories. The solution consists of a **.NET 10 (C#) backend** exposing a REST API (with JWT authentication) and a **React + Vite (TypeScript)** frontend.

Key capabilities include:
- Search & filter customers with advanced criteria (registered / upgraded / trial hidden, product selection, perpetual vs subscription, text presence, etc.)
- View & edit license details, comments, and days‑left calculations
- Extend licenses (online/offline), manual upgrades, and link parent‑child keys
- CRUD operations for resellers and subscriptions
- Export search results to Excel
- Restore keys, delete/undelete history, and bulk‑email wizard
- Responsive UI powered by `@tanstack/react-table`
- Automated end‑to‑end tests with Playwright

The UI follows a modern glass‑morphism design with vibrant colours, smooth transitions and micro‑animations for a premium user experience.

---

## 🏗️ Architecture

```
CADdirektAdminWeb
├─ backend               # ASP.NET Core API (.NET 10)
│   ├─ Controllers      # Customer, License, Reseller, Auth
│   ├─ Models           # DTOs & DB entities
│   ├─ Services         # Business logic, Dapper DB access
│   └─ Program.cs       # App bootstrap, JWT, CORS, Swagger
├─ frontend              # Vite + React (TypeScript)
│   ├─ src
│   │   ├─ pages        # Dashboard, Login, etc.
│   │   ├─ utils        # auth helper, API wrappers
│   │   └─ components   # reusable UI pieces
│   └─ public           # static assets
└─ docker-compose.yml   # Optional docker compose for dev
```

- **Backend** runs on `http://localhost:5000` (configurable via `launchSettings.json`).
- **Frontend** runs on `http://localhost:5173` (Vite dev server).
- CORS is pre‑configured to allow the frontend origin.
- Authentication uses JWT stored in `localStorage`; the helper `getAuthHeaders()` adds the `Authorization` header to each request.

---

## 📦 Prerequisites

- **Windows** (PowerShell) – the repository is already set up for Windows line endings.
- **.NET SDK 10** – `dotnet` CLI must be on your PATH.
- **Node.js ≥ 18** and **npm** – for the frontend.
- (Optional) **Docker** – to run the whole stack in containers.

---

## 🚀 Running the Application (Development)

### 1️⃣ Backend
```powershell
cd E:\admin_16Jun2026\CADdirektAdminWeb\backend
# Restore packages and run
dotnet run --urls=http://localhost:5000
```
The API will start and listen on **http://localhost:5000**.

### 2️⃣ Frontend
Open a second terminal:
```powershell
cd E:\admin_16Jun2026\CADdirektAdminWeb\frontend
# Install dependencies (once)
npm ci   # or `npm install`
# Start Vite dev server
npm run dev
```
Open your browser at **http://localhost:5173** and log in using a valid user from the database.

---

## 🧪 Testing

Playwright tests are located in `frontend/tests/`. To run them:
```powershell
cd E:\admin_16Jun2026\CADdirektAdminWeb\frontend
npx playwright test   # or `npm run test` if defined
```
Timeouts have been increased to accommodate the remote SQL latency.

---

## 📂 Repository Structure
- `backend/` – C# API source
- `frontend/` – React UI source
- `docker-compose.yml` – optional multi‑container dev setup
- `frontend/tests/` – Playwright end‑to‑end test suite
- `frontend/.gitignore` – ignores build artefacts
- `README.md` – (this file) – top‑level documentation

---

## 🛠️ Build & Deploy (Production)
1. **Backend** – publish a self‑contained release:
```powershell
cd backend
 dotnet publish -c Release -o publish
```
2. **Frontend** – create a production bundle:
```powershell
cd ../frontend
 npm run build
```
3. Serve the static files with any web server (IIS, Nginx, Docker). The repository includes a sample `Dockerfile` for each side and a `docker-compose.yml` that wires them together.

---

## 📚 Further Reading
- **API Docs** – Swagger UI available at `http://localhost:5000/swagger` when the backend runs.
- **Design System** – Colours, fonts and glass‑morphism effects are defined in `frontend/src/App.css` and the component library under `frontend/src/components/`.
- **Database** – The schema is stored in `backend/schema_check.ps1` and the original SQL script `DBScript.sql` (outside of repo).

---

## 🤝 Contributing
Feel free to open issues or submit pull requests. Follow the standard GitHub flow:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my‑feature`)
3. Commit your changes (`git commit -m "Add feature …"`)
4. Push (`git push origin feature/my‑feature`)
5. Open a PR.

---

## 📜 License
This project is licensed under the **MIT License** – see `LICENSE` for details.

---

*Enjoy managing your CADdirekt licences with a modern, fast and beautiful web interface!*
