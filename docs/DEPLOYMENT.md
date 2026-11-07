# PulmoVision AI — Deployment & Infrastructure Guide (`DEPLOYMENT.md`)

## 1. Environment Variables (`backend/.env.example`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `APP_NAME` | `"PulmoVision AI"` | Service identifier |
| `ENVIRONMENT` | `"development"` | `development` or `production` |
| `JWT_SECRET_KEY` | *(required in prod)* | Secret key for HS256 JWT token signing |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Session expiration window |
| `DATABASE_URL` | `sqlite:///./pulmovision.db` | SQLAlchemy URI (`postgresql+psycopg2://...` in prod) |
| `LOCAL_STORAGE_PATH` | `./storage` | Persistent directory for volumes, masks, meshes, and reports |
| `MODEL_CACHE_PATH` | `./model_cache` | Directory for SHA-256 verified `.pth` weights |
| `MAX_UPLOAD_SIZE_MB` | `512` | Upload size limit |
| `INFERENCE_DEVICE` | `cpu` | `cpu` or `cuda` |
| `INFERENCE_BATCH_SIZE` | `4` | Slices per U-Net forward batch (`4` caps CPU RSS at ~1.1 GB) |
| `INFERENCE_CPU_THREADS` | `6` | PyTorch intra-op thread count |
| `MAX_CONCURRENT_JOBS` | `1` | Background job worker concurrency |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed frontend origins |

---

## 2. Docker & Docker Compose Deployment

PulmoVision AI separates the **Frontend**, **Backend API + AI Engine**, and **PostgreSQL Database** in `docker-compose.yml` with persistent volumes for database records, medical scan storage, and cached model weights:

```bash
docker compose up --build -d
```

* **Frontend UI:** `http://localhost:5173`
* **Backend API & OpenAPI Docs:** `http://localhost:8000/docs`
* **PostgreSQL 16:** Port `5432` (internal network)

---

## 3. Infrastructure Sizing Recommendations

Because medical image segmentation loads 3D CT arrays and runs a 5-level U-Net:
* **Do NOT deploy the AI worker on 512 MB free-tier shared containers** (they will terminate with `SIGKILL` / OOM).
* **Minimum CPU Instance:** 2–4 vCPUs, **4 GB dedicated RAM** (`INFERENCE_BATCH_SIZE=4`, `MAX_CONCURRENT_JOBS=1`).
* **Recommended Production Instance:** 4–8 vCPUs, **8–16 GB RAM** (or NVIDIA T4 / L4 GPU with `INFERENCE_DEVICE=cuda` and `INFERENCE_BATCH_SIZE=16`, which reduces 300-slice inference from ~60s to <3s).

