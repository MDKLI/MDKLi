# Developer Notes (Model Development Only)

These steps are only required if you want to retrain the model, modify the
data pipeline, or work with deployment/orchestration. If you only need to
run the API, see [README.md](README.md) instead.

## Project structure

```
config/            Centralized settings (config/settings.py), read from .env
src/                Pure-logic Strategy Pattern modules (cleaning, feature
                    engineering, scaling, model building, evaluation, etc.)
steps/              ZenML @step wrappers around src/ logic
pipelines/          ZenML pipeline definitions (training, deployment)
app/                FastAPI application (routes, vision client, middleware)
scripts/            One-off entry points (run_pipeline, compute_field_medians,
                    run_deployment)
tests/unit/         Fast, isolated tests of src/ and steps/ logic
tests/integration/  Full-stack tests against a running FastAPI app instance
docker/             Dockerfile, entrypoint.sh, docker-compose.yml
k8s/base/           Base Kubernetes manifests
k8s/overlays/       dev/ and prod/ Kustomize overlays (image tag, replicas,
                    resource limits, ingress host differ per environment)
data/raw/           DVC-tracked source dataset (see "Data versioning" below)
artifacts/          Trained model, encoders, scaler, transformer, manifest
```

## Setup

If you haven't already cloned the repo, follow the sparse-checkout steps
in [README.md](README.md#setup) first to get just the `ML_tests/CBC`
folder, then run the following from inside it:

```bash
cp .env.example .env
make install-dev
```

Then open `.env` and set at minimum:

```
GEMINI_API_KEY=your-actual-key-here
```

## ZenML

```bash
pip install --upgrade "zenml[server]==0.96.2"

# initialize the repository (first time only)
zenml init

# start the local ZenML server
zenml up

# verify that the server is running
zenml status
```

## Data versioning (DVC)

The raw dataset lives under `data/raw/` and is tracked with DVC as a single
unit (`data.dvc` at the repo root), not a live external link, and not
tracked directly by git (`/data` is in `.gitignore` — DVC manages it via
content hash instead). This replaces an earlier version that pulled
directly from a public Google Drive URL on every run:

- A live URL has no content hash — if the file at that URL is ever edited,
  a re-run can silently train on different data with no code change to
  point to, or fail outright if Drive rate-limits the download (a known
  issue for larger files under the free tier, and especially disruptive to
  an automated `retrain.yml` workflow).
- DVC pins the exact bytes used for any given model version, and detects
  drift explicitly (`dvc status`) instead of silently.

**DVC is already initialized in this repo** (`.dvc/config`, `data.dvc`).
One manual step remains before `dvc push`/`dvc pull` will work: replace the
placeholder folder ID in `.dvc/config` with your real Google Drive folder
ID, and set up service-account access for it (see below).

```bash
# One-time: point the remote at your actual Drive folder
dvc remote modify gdrive_remote url gdrive://<your-real-folder-id>
```

To (re)push the currently-bundled data to your configured remote:

```bash
dvc push
```

To get the data on a fresh clone:

```bash
dvc pull
```

### Setting up the Google Drive service account
(needed for `dvc push`/`pull` outside your own machine, e.g. in `retrain.yml`)

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a project
2. **APIs & Services → Library** → enable **Google Drive API**
3. **APIs & Services → Credentials → Create Credentials → Service Account**
4. Open the created service account → **Keys** tab → **Add Key → Create new key → JSON**
5. Share your target Drive folder with the service account's email
   (`xxx@xxx.iam.gserviceaccount.com`, found in the downloaded JSON) — Editor access
6. Copy the folder ID from the Drive folder's URL (`.../folders/<this-part>`)
   into `.dvc/config` as shown above
7. For CI (`retrain.yml`): add the entire downloaded JSON file's contents as
   a repository secret named `DVC_GDRIVE_CREDENTIALS`

Note: this project does **not** use `dvc.yaml` pipeline stages, and there
is no `dvc.yaml` file in this repo. ZenML already owns pipeline
orchestration (`pipelines/train_pipeline.py`); adding a second orchestrator
on top would create two competing sources of truth for "what runs in what
order." DVC's role here is scoped deliberately to data (and optionally
model artifact) *versioning* only — `dvc add` / `data.dvc`, not `dvc repro`.

## Running the training pipeline

```bash
make train      # python -m scripts.run_pipeline
make medians    # regenerates artifacts/field_medians.json from the same data
```

## Deploying (Kubernetes)

```bash
make deploy-dev     # kubectl apply -k k8s/overlays/dev
make deploy-prod    # kubectl apply -k k8s/overlays/prod
```

`k8s/overlays/dev` and `k8s/overlays/prod` each pin their own image tag
(`:dev` and a specific version respectively) rather than `:latest` — the
base manifests' `:latest` is a local/minikube-testing convenience only.
If you build a new image locally for minikube, rebuild with
`make docker-build-nocache` after changing anything Docker's layer cache
might otherwise consider unchanged (e.g. `docker/entrypoint.sh`), since a
cache hit there will silently keep serving the previous script.
