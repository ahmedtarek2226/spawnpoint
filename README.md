# Spawnpoint

A self-hosted Minecraft server management dashboard. Run and manage multiple Minecraft servers from a single web UI, with real-time console, file management, backups, and player tracking — all containerized with Docker.

## Features

- Start, stop, and monitor multiple Minecraft servers
- Real-time console with command input via WebSocket
- File manager with editor, upload, download, and conflict resolution
- World backups with modpack version detection (BCC, CurseForge, Modrinth, MultiMC)
- Player list with online count
- Import servers from Prism Launcher exports
- Supports NeoForge, Fabric, Forge, and vanilla via [itzg/minecraft-server](https://github.com/itzg/docker-minecraft-server)

## Requirements

- Docker with Compose
- Docker socket access (the dashboard manages containers on your behalf)

## Setup

1. Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Set `HOST_DATA_DIR` to the absolute path where you want server data stored. Optionally set `DASHBOARD_USER` and `DASHBOARD_PASSWORD` to enable login.

2. Start the dashboard:

```bash
docker compose up -d
```

3. Open `http://localhost:3000` in your browser.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_PORT` | `3000` | Port the dashboard listens on |
| `HOST_DATA_DIR` | `./data` | Absolute path on the host for server data storage |
| `DASHBOARD_USER` | — | Username for dashboard access (unset = no auth) |
| `DASHBOARD_PASSWORD` | — | Password for dashboard access (unset = no auth) |
| `CORS_ORIGIN` | — | Allowed CORS origin(s), comma-separated, or `*`. Unset = same-origin only |

## Development

**Backend** (Bun + Express + TypeScript):
```bash
cd backend
bun install
bun run dev
```

**Frontend** (Vite + React + TypeScript):
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies API requests to the backend at `http://localhost:3001`.

## Tech stack

**Backend**
- [Bun](https://bun.sh) — runtime and package manager
- [Express](https://expressjs.com) — HTTP server
- [Dockerode](https://github.com/apocas/dockerode) — Docker API client
- [ws](https://github.com/websockets/ws) — WebSocket server for real-time console
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — embedded database for server configs and backups
- [archiver](https://github.com/archiverjs/node-archiver) — backup zip creation
- [yauzl](https://github.com/thejoshwolfe/yauzl) — zip extraction for Prism imports

**Frontend**
- [React](https://react.dev) — UI framework
- [Vite](https://vitejs.dev) — dev server and build tool
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Zustand](https://zustand-demo.pmnd.rs) — client state management
- [React Router](https://reactrouter.com) — client-side routing
- [Lucide](https://lucide.dev) — icons

**Infrastructure**
- [Docker](https://www.docker.com) — containerisation
- [itzg/minecraft-server](https://github.com/itzg/docker-minecraft-server) — Minecraft server image

## How it works

Spawnpoint runs as a Docker container with access to the Docker socket. When you create or start a server, it spins up a separate `itzg/minecraft-server` container with the appropriate configuration, bind-mounting a subdirectory of `HOST_DATA_DIR` as the server's data volume.

The dashboard communicates with running servers over RCON (commands) and Docker logs (console output).