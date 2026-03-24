# Spawnpoint — Project Instructions

## After completing any change

Always rebuild and restart the Docker container so changes are live:

```bash
docker compose up -d --build
```

## Common Commands

```bash
docker compose up -d --build   # Rebuild and restart
docker compose logs -f         # Follow logs
docker compose down            # Stop
```

## Dev (without Docker)

```bash
# Backend
cd backend && bun run dev

# Frontend
cd frontend && npm run dev
```
