.PHONY: help install install-dev test test-unit test-integration lint format \
        docker-build docker-build-nocache docker-run train medians \
        deploy-dev deploy-prod clean

IMAGE_NAME ?= omaraldujawy/cbc-api
IMAGE_TAG  ?= latest

help:
	@echo "Common targets:"
	@echo "  make install          Install runtime dependencies (requirements/api.txt)"
	@echo "  make install-dev      Install dev dependencies (requirements/dev.txt)"
	@echo "  make test             Run the full test suite"
	@echo "  make test-unit        Run unit tests only (fast, no live model needed)"
	@echo "  make test-integration Run integration tests (needs artifacts/ present)"
	@echo "  make lint              Run pre-commit hooks against all files"
	@echo "  make docker-build      Build the API image (IMAGE_TAG=$(IMAGE_TAG))"
	@echo "  make docker-build-nocache  Build with --no-cache (use after editing entrypoint.sh"
	@echo "                             or any Dockerfile COPY'd file that Docker might"
	@echo "                             otherwise treat as unchanged and skip)"
	@echo "  make docker-run        Run docker-compose stack locally"
	@echo "  make train             Run the training pipeline locally (python -m scripts.run_pipeline)"
	@echo "  make medians           Regenerate artifacts/field_medians.json"
	@echo "  make deploy-dev        Apply the dev kustomize overlay"
	@echo "  make deploy-prod       Apply the prod kustomize overlay"
	@echo "  make clean             Remove __pycache__/.pytest_cache/build junk"

install:
	pip install -r requirements/api.txt

install-dev:
	pip install -r requirements/dev.txt

test:
	pytest tests/ -v

test-unit:
	pytest tests/unit -v

test-integration:
	pytest tests/integration -v

lint:
	pre-commit run --all-files

docker-build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) -f docker/Dockerfile .

docker-build-nocache:
	docker build --no-cache -t $(IMAGE_NAME):$(IMAGE_TAG) -f docker/Dockerfile .

docker-run:
	docker compose -f docker/docker-compose.yml up --build

train:
	python -m scripts.run_pipeline

medians:
	python -m scripts.compute_field_medians

deploy-dev:
	kubectl apply -k k8s/overlays/dev

deploy-prod:
	kubectl apply -k k8s/overlays/prod

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
