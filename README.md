# homebrew-nal-web

<p align="center">
  <img src=".github/assets/hero-banner.jpg" alt="Homebrew NAL Registry — Prebuilt Bottle Catalog & Live Build Queue for macOS Intel (x86_64)" width="100%">
</p>

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Kysely](https://img.shields.io/badge/ORM-Kysely-orange)](https://kysely.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)](https://www.docker.com/)
[![Vitest](https://img.shields.io/badge/Tests-86%20Passing-green?logo=vitest)](https://vitest.dev/)

The official package registry, bottle distribution portal, and automated runner dispatch dashboard for the [**homebrew-nal**](https://github.com/Jaewoook/homebrew-nal) tap.

🌐 **Live Registry**: [https://homebrew-nal.jaewook.dev](https://homebrew-nal.jaewook.dev)  
📦 **Homebrew Tap**: [https://github.com/Jaewoook/homebrew-nal](https://github.com/Jaewoook/homebrew-nal)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Running Tests](#running-tests)
- [Database Configuration](#database-configuration)
- [Deployment](#deployment)
  - [Standalone Docker Compose](#standalone-docker-compose)
  - [Production Stack (Reverse Proxy + PostgreSQL)](#production-stack-reverse-proxy--postgresql)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Upstream Homebrew 4.x classifies macOS Intel (`x86_64`) as Tier 3 and has ceased publishing pre-built binary bottles for Intel Macs, forcing formulae to compile from source. The [**homebrew-nal**](https://github.com/Jaewoook/homebrew-nal) tap provides a dedicated Intel runner that automatically packages binary bottles for **macOS Intel (`x86_64`)** (supporting macOS 15+ — Sequoia, Tahoe, and later) so users can install software instantly with zero source compilation.

**`homebrew-nal-web`** serves as the public frontend and control center for the tap:
- Catalogs all bottled packages and parses formula Ruby definitions dynamically.
- Surfaces upstream version differences against official Homebrew Core.
- Streams live bottle builder activity directly from GitHub Actions.
- Allows authenticated users to trigger on-demand sync and build dispatches.
- Provides external community members a clear workflow to request new packages.

---

## Key Features

<p align="center">
  <img src=".github/assets/showcase.jpg" alt="Homebrew NAL Registry — Interactive Catalog & Live Build Queue" width="100%">
</p>

- 🔍 **Interactive Formula Catalog**: Instant client-side search, runtime dependency visualizers, bottle sizes, platform tags, and one-click `brew install` commands.
- ⚡ **Live Build Queue Stream**: Real-time status monitoring of GitHub Actions runner workflows with actor attribution, duration timers, and direct run links.
- 🚀 **On-Demand Build Dispatch**: Authenticated users can request formula synchronization and bottle compilation with configurable options (`force`, `with_deps`).
- 🔐 **Authentik OIDC Authentication**: Secure Single Sign-On via Authentik OAuth2/OIDC with encrypted HMAC session cookies.
- 🗄️ **Multi-Dialect SQL Database**: Built with [Kysely](https://kysely.dev/) query builder, dynamically supporting **SQLite**, **PostgreSQL**, and **MySQL / MariaDB** with automated schema migrations.
- 🛡️ **Hardened Security**: Pre-configured HTTP security headers (CSP, HSTS, X-Frame-Options, nosniff), per-user rate limiting (3 dispatches max), and input sanitization against injection attacks.
- 📦 **Zero-Config Standalone Operation**: Runs out of the box with an embedded SQLite database and local volume persistence, or integrates seamlessly with enterprise databases and reverse proxies.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, React 19, Server Components) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **Database / ORM** | [Kysely](https://kysely.dev/) with `better-sqlite3`, `pg`, and `mysql2` |
| **Testing** | [Vitest](https://vitest.dev/), `@testing-library/react`, JSDOM |
| **Containerization**| Docker multi-stage build (`node:22-alpine`), Docker Compose |

---

## Architecture

```mermaid
flowchart TD
    User["Client Browser"] -->|HTTP / HTTPS| WebApp["homebrew-nal-web (Next.js 15)"]
    WebApp -->|OIDC Auth| Authentik["Authentik OIDC Provider"]
    WebApp -->|REST API & Octokit| GitHub["GitHub Actions & Releases API"]
    GitHub -->|Trigger Workflow| Runner["macOS Intel Runner"]
    Runner -->|Publish Bottle| TapRepo["Jaewoook/homebrew-nal"]
    WebApp -->|Query & Cache| DB[(SQL Database: SQLite / Postgres / MySQL)]
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [Yarn](https://classic.yarnpkg.com/) v1.22+
- (Optional) [Docker](https://www.docker.com/) & Docker Compose

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Jaewoook/homebrew-nal-web.git
   cd homebrew-nal-web
   ```

2. **Install dependencies:**
   ```bash
   yarn install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to configure your `GITHUB_TOKEN` and optional Authentik credentials. By default, it will run with an embedded SQLite database.*

4. **Start the development server:**
   ```bash
   yarn dev
   ```
   Open [http://localhost:10245](http://localhost:10245) (or the port defined in `.env`) in your browser.

### Running Tests

The test suite covers unit tests for formula parsing, rate limiting, database operations, and API integration:

```bash
# Run all tests once
yarn test

# Run tests in watch mode
yarn vitest
```

---

## Database Configuration

`homebrew-nal-web` uses [Kysely](https://kysely.dev/) for type-safe query building and automatically initializes all required tables (`dispatches`, `catalog_cache`, `upstream_cache`) on startup.

The database engine is dynamically selected based on your environment configuration:

### Option 1: SQLite (Default Standalone)
No extra configuration required. It uses `data/app.db` automatically:
```env
DB_TYPE=sqlite
DATABASE_PATH=data/app.db
```

### Option 2: Unified Connection String (`DATABASE_URL`)
Accepts standard connection URLs for any supported SQL database:
```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/homebrew_nal

# MySQL / MariaDB
DATABASE_URL=mysql://root:password@localhost:3306/homebrew_nal

# SQLite
DATABASE_URL=sqlite:///app/data/app.db
```

### Option 3: Individual PostgreSQL Variables
```env
PG_HOST=localhost
PG_PORT=5432
PG_DB=homebrew_nal
PG_USER=homebrew_nal
PG_PASS=your_password
```

### Option 4: Individual MySQL / MariaDB Variables
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=homebrew_nal
MYSQL_USER=root
MYSQL_PASSWORD=your_password
```

---

## Deployment

### Standalone Docker Compose

To deploy the standalone web portal on any server:

```bash
# 1. Prepare configuration
cp .env.example .env

# 2. Build and start container
docker compose up -d
```

The container maps port `10245` to the host and persists its SQLite database in the `homebrew_nal_data` Docker volume.

### Production Stack (Reverse Proxy + PostgreSQL)

For deployment behind Nginx Proxy Manager and Cloudflare Tunnel with shared PostgreSQL:

```yaml
services:
  homebrew-nal-web:
    image: homebrew-nal-web:latest
    container_name: homebrew-nal-web
    restart: unless-stopped
    expose:
      - 10245
    env_file:
      - .env
    networks:
      - default
      - db_network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:10245/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  default:
    external: true
    name: nginx_network
  db_network:
    external: true
```

---

## Environment Variables

| Variable | Description | Default | Required? |
| :--- | :--- | :--- | :---: |
| `PORT` | HTTP server listening port | `10245` | No |
| `GITHUB_TOKEN` | GitHub Personal Access Token (repo & workflow scope) | — | Recommended |
| `GITHUB_REPO_OWNER` | Owner of the tap repository | `jaewoook` | No |
| `GITHUB_REPO_NAME` | Name of the tap repository | `homebrew-nal` | No |
| `GITHUB_SYNC_WORKFLOW` | GitHub Actions workflow file for upstream sync | `sync-upstream.yml` | No |
| `GITHUB_BUILD_WORKFLOW` | GitHub Actions workflow file for bottle builds | `build.yml` | No |
| `AUTHENTIK_ISSUER` | Authentik OIDC OpenID Configuration Issuer URL | — | For Auth |
| `AUTHENTIK_CLIENT_ID` | Authentik OAuth2 Client ID | — | For Auth |
| `AUTHENTIK_CLIENT_SECRET` | Authentik OAuth2 Client Secret | — | For Auth |
| `NEXTAUTH_SECRET` | 32+ character random hex string for signing session cookies | — | Yes (Prod) |
| `NEXTAUTH_URL` | Canonical public FQDN of the web application | `http://localhost:10245` | Yes (Prod) |
| `DATABASE_URL` | Generic database connection string | — | No |
| `DB_TYPE` | Explicit dialect (`sqlite`, `postgres`, `mysql`) | `sqlite` | No |
| `DATABASE_PATH` | Path to SQLite database file | `data/app.db` | No |
| `CACHE_TTL_SECONDS` | In-memory formula catalog cache expiration | `600` | No |

---

## API Reference

### Health Check
- `GET /api/health`
  - Returns container status, service identifier, and uptime.
  ```json
  { "status": "ok", "service": "homebrew-nal-web", "uptime": 124.5 }
  ```

### Formulas Catalog
- `GET /api/formulas`
  - Returns the list of parsed tap formulas, bottle metadata, dependencies, and upstream versions.

### Build Stream & Activity
- `GET /api/builds`
  - Fetches recent and in-progress GitHub Actions workflow runs.

### Build Dispatch
- `POST /api/builds/dispatch`
  - Triggers a runner synchronization or bottle compilation.
  - Requires active Authentik session cookie (`nal_session`).
  - **Body**:
    ```json
    {
      "formula": "node",
      "force": false,
      "with_deps": true
    }
    ```

### Authentication
- `GET /api/auth/login` - Initiates Authentik OIDC OAuth authorization flow.
- `GET /api/auth/callback` - Exchanges OIDC authorization code for user session.
- `POST /api/auth/logout` - Clears session cookie and signs out user.
- `GET /api/auth/session` - Returns the currently authenticated user's profile.

---

## Contributing

We welcome community contributions! Please review our issue and pull request templates before submitting:

- 🐛 [Report a Bug](https://github.com/Jaewoook/homebrew-nal-web/issues/new?template=bug_report.yml)
- 💡 [Propose a Feature](https://github.com/Jaewoook/homebrew-nal-web/issues/new?template=feature_request.yml)
- 📦 [Request a New Formula / Bottle](https://github.com/Jaewoook/homebrew-nal-web/issues/new?template=new_formula_request.yml)
- 📝 [Improve Documentation](https://github.com/Jaewoook/homebrew-nal-web/issues/new?template=documentation.yml)

### Pull Request Guidelines
1. Ensure all unit and integration tests pass: `yarn test`.
2. Ensure the standalone Next.js build succeeds: `yarn build`.
3. Commits must be GPG signed (`git commit -S`).

---

## License

This project is licensed under the [MIT License](LICENSE).
