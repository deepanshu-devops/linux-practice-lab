# Linux Practice Lab (Web Terminal)

A browser-based Linux practice lab: a **Flask + Socket.IO** backend that spawns a real
`/bin/bash` session (via PTY) inside the container and streams it to the browser over
WebSockets. Includes a built-in exercise tracker, command-guide, and sandboxed lab files.

## Flow

```
Browser (xterm.js) --Socket.IO/websocket--> Flask/Socket.IO (port 5000) --PTY--> /bin/bash
```

## Run locally

```bash
docker build -t linux-practice-lab .
docker run -p 5000:5000 linux-practice-lab
# open http://localhost:5000
```

## Deploy (free, public)

### Option A — Render from GitHub (recommended, auto-deploys on push)

1. Push this repo to GitHub.
2. On [render.com](https://render.com) → **New → Blueprint** → connect the repo.
3. Render reads `render.yaml` (Docker runtime, free plan, health check on `/`) and
   deploys. You get a public URL like `https://linux-practice-lab.onrender.com`.

### Option B — Render from Docker Hub image

1. `docker build -t deepkush2631/linux-practice-lab . && docker push deepkush2631/linux-practice-lab`
2. Render → **New → Web Service** → *Deploy from Docker Hub* → image name → port **5000** → **Create**.

> Free-plan notes: the service spins down after ~15 min idle and wakes on the next
> request (cold start ~30–60 s). WebSockets work on the free tier.
