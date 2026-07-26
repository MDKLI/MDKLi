#!/bin/bash
set -e

# Populate PVC with default artifacts if empty.
# Guarded with an atomic mkdir-based lock: when several replicas (or a
# training Job) share the same PVC and start at once, only one of them
# should perform the copy - otherwise two concurrent `cp` calls into the
# same files can race and leave a corrupted/partial model file behind.
# Previously this only checked for cbc_hierarchical_model.pkl before copying
# the ENTIRE default_artifacts/ directory. That meant: once the PVC had a
# model file from any earlier init, the whole copy was skipped forever - so
# an artifact added to the image LATER (field_medians.json, in this case)
# never made it onto an already-initialized PVC, even after rebuilding and
# redeploying the image. `cp -rn` (no-clobber) run unconditionally on every
# boot fixes this: it backfills any file present in the image but missing
# from the PVC, while never touching a file the PVC already has (so a
# training Job's freshly-written model is never overwritten by the stale
# image copy).
LOCK_DIR="/app/artifacts/.init.lock"
retries=0
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    retries=$((retries + 1))
    if [ "$retries" -gt 30 ]; then
        echo "Timed out waiting for another replica to finish artifact sync." >&2
        exit 1
    fi
    echo "Artifacts volume is being synced by another replica, waiting..."
    sleep 1
done
echo "Syncing any missing default artifacts onto the volume..."
cp -rn /app/default_artifacts/. /app/artifacts/
rmdir "$LOCK_DIR"

case "$1" in
  api)
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
    ;;
  train)
    shift
    python -m scripts.run_pipeline "$@"
    # Recompute field medians from the same source dataset every time
    # training runs, so this artifact can never silently go stale relative
    # to the model it's meant to support at inference time.
    exec python -m scripts.compute_field_medians
    ;;
  deploy-pipeline)
    shift
    exec python -m scripts.run_deployment "$@"
    ;;
  medians)
    exec python -m scripts.compute_field_medians
    ;;
  shell)
    exec /bin/bash
    ;;
  *)
    exec "$@"
    ;;
esac