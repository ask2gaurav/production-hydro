# Colon Hydrotherapy Management System

A full‑stack, HIPAA‑aware, offline‑first management system for Colon Hydrotherapy machines. It provides a secure admin panel for clinic staff and a tablet‑optimized Progressive Web App (PWA) for therapists to run sessions, even without an internet connection.

---

## 📖 Purpose

The system solves three core problems for hydrotherapy clinics:
1. **Centralised patient & session records** – All data is stored in a single MongoDB instance, with role‑based access control to protect sensitive information.
2. **Offline operation** – Therapists can start a machine, log a session, and adjust settings without network connectivity. Data is automatically synced when the connection is restored.
3. **Demo‑mode licensing** – New machines ship with a limited number of demo sessions. Once exhausted, the UI locks and prompts the supplier for an upgrade.

---

## 🚀 Features

- **Admin Panel** (React Router v7, SSR) – Manage users, machines, owners, suppliers, and view audit logs.
- **Therapist PWA** (Ionic React, Vite) – Tablet‑first UI, works offline via Service Workers and IndexedDB (Dexie).
- **Robust sync layer** – Axios interceptor queue + Workbox background sync ensures eventual consistency.
- **HIPAA‑ready security** – HTTP‑only JWT cookies, strict CORS, role‑based permissions.
- **Docker‑Compose orchestration** – One‑command dev environment with hot‑reloading containers.

---

## 🏗️ Architecture Overview

```
+-------------------+          +-------------------+          +-------------------+
|   Frontend PWA    |  <--->   |   Backend API     |  <--->   |   MongoDB         |
| (Ionic React)    |  HTTP    | (Node/Express)    |  Mongoose|   (Docker)        |
+-------------------+          +-------------------+          +-------------------+
        ^                               ^
        |                               |
        |   Service Worker + Dexie.js   |
        +-------------------------------+
```

- **Frontend** lives in `/frontend` and is served on port **5173**.
- **Backend/Admin** lives in `/backend` and is served on port **3000**.
- **MongoDB** runs in its own container (default port **27017**).

---

## 🛠️ Prerequisites

- **Node.js** v20 or newer
- **Docker** & **Docker Compose** (v2)
- **Git**

---

## ⚙️ Setup & Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your‑org/colon‑hydro‑system.git
   cd colon‑hydro‑system
   ```

2. **Create an environment file**
   ```bash
   cp .env.example .env
   # Edit .env as needed (Mongo credentials, JWT secret, etc.)
   ```

3. **Start the stack** (Docker Compose watches for file changes and hot‑reloads)
   ```bash
   docker compose up --watch
   ```
   - Backend API will be available at `http://localhost:3000`.
   - Admin UI at `http://localhost:3000/admin`.
   - Frontend PWA at `http://localhost:5173`.

4. **Seed the database (optional but recommended for first run)**
   ```bash
   # Inside the running backend container or locally:
   npm run seed   # located in /backend
   ```
   Default admin credentials:
   - **Email:** `admin@hydrosys.com`
   - **Password:** `adminpassword123`

5. **Develop**
   - Edit files under `/frontend` or `/backend`; changes are reflected instantly thanks to the `--watch` flag.
   - Linting and type‑checking are enforced via the provided `npm run lint` scripts.

---

## 📋 Usage Examples

### Admin Panel
- Log in with the admin credentials.
- Create **Users**, **Machines**, **Owners**, and **Suppliers**.
- View **Audit Logs** for compliance.

### Therapist PWA
- Open the PWA on a tablet or in a browser (landscape mode recommended).
- Select a patient, start a session, and the app will:
  1. Record timestamps locally.
  2. Store session data in IndexedDB.
  3. Queue the POST request to `/api/sessions`.
  4. Sync automatically when the network returns.

### API Example (cURL)
```bash
# Authenticate and obtain a JWT cookie
curl -X POST http://localhost:3000/api/auth.login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hydrosys.com","password":"adminpassword123"}' -c cookies.txt

# Create a new patient (requires auth cookie)
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"firstName":"John","lastName":"Doe","dob":"1990-01-01"}'
```

---

## 🤝 Contribution Guidelines

1. **Fork the repository** and clone your fork.
2. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Make your changes**. Follow the existing code style (Prettier + ESLint). Run:
   ```bash
   npm run lint && npm run format
   ```
4. **Write tests** (if applicable) and ensure the test suite passes:
   ```bash
   npm test
   ```
5. **Commit with a clear message** and push:
   ```bash
   git push origin feat/your-feature-name
   ```
6. **Open a Pull Request** against the `main` branch. Include:
   - A concise title.
   - Description of the change.
   - Any relevant screenshots or API documentation updates.
   - Reference to related issue numbers (e.g., `Closes #42`).

### Code of Conduct
We expect all contributors to adhere to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.

---

## 📞 Support

For questions, open an issue or contact the project maintainers at `support@hydrosys.com`.
