## Project Structure

```
```mdkli/
├── .github/
│ └── workflows/
│ ├── build-backend.yml # CI for all backend services
│ └── build-frontend.yml # CI for all frontends
│
├── backend/ # All backend services
│ ├── auth/ # Service 1
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── models.py
│ │ │ ├── routers/
│ │ │ ├── services/
│ │ │ └── events.py # Redis pub/sub handlers
│ │ ├── Dockerfile
│ │ ├── requirements.txt
│ │ └── pyproject.toml
│ │
│ ├── patient/ # Service 2 (similar structure)
│ ├── clinic-search/ # Service 3 (PostGIS)
│ ├── pharmacy-search/ # Service 4
│ ├── booking/ # Service 5
│ ├── chat/ # Service 6 (WebSocket)
│ ├── notification/ # Service 7
│ ├── emergency/ # Service 8
│ ├── ai-conversation/ # Service 9 (AI store)
│ └── wearable/ # Service 10 (post-demo)
│
├── frontend/ # Micro frontends
│ ├── landing/ # Next.js (public site + auth)
│ │ ├── src/
│ │ ├── Dockerfile
│ │ ├── package.json
│ │ └── next.config.js
│ │
│ ├── dashboard/ # Next.js (patient dashboard)
│ ├── search/ # Next.js (clinic + pharmacy search)
│ ├── ai-assistant/ # Next.js (chatbot UI)
│ ├── chat/ # React or SvelteKit (real-time)
│ └── admin/ # React (Refine.dev panel)
│
├── shared/ # Shared code across services
│ ├── types/ # TypeScript / Pydantic shared models
│ │ ├── events/ # Event schemas (Redis pub/sub)
│ │ └── api/ # Common API DTOs
│ ├── utils/ # Shared helpers (JWT, logging)
│ └── libs/ # If using monorepo tools (pnpm/nx)
│
├── deploy/
│ ├── docker-compose/ # Local dev
│ │ ├── docker-compose.yml # Everything + DBs + Redis + MinIO │ │ └── .env.example
│ │
│ └── kubernetes/ # K8s manifests (ArgoCD sync)
│ ├── base/ # Shared base configs (namespaces, secrets)
│ │ ├── namespace.yaml
│ │ └── ingress-controller.yaml
│ ├── services/ # Per-service K8s resources
│ │ ├── auth/
│ │ │ ├── deployment.yaml
│ │ │ ├── service.yaml
│ │ │ ├── configmap.yaml
│ │ │ └── hpa.yaml
│ │ ├── patient/
│ │ └── ... (each service)
│ ├── frontends/ # Per-frontend K8s resources
│ │ ├── landing/
│ │ ├── dashboard/
│ │ └── ...
│ └── infra/ # PostgreSQL, Redis, MinIO
│ ├── postgres.yaml # CloudNativePG or StatefulSet
│ ├── redis.yaml
│ └── minio.yaml
│
├── scripts/
│ ├── build-all.sh # Build all Docker images
│ ├── deploy-dev.sh # Start docker-compose
│ └── deploy-k8s.sh # Apply K8s manifests
│
├── .gitignore
├── README.md # How to run locally + K8s setup
└── Makefile # Common tasks (make dev, make build)
```
```
[View on Eraser![](https://app.eraser.io/workspace/oHGz8eBGl64Y9LdqYTRI/preview?diagram=ItUwEJnIaBolMM5IJ2_og&type=embed)](https://app.eraser.io/workspace/oHGz8eBGl64Y9LdqYTRI?diagram=ItUwEJnIaBolMM5IJ2_og)
