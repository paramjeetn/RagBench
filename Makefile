.PHONY: up up-backend up-frontend down build build-backend build-frontend \
        logs logs-backend logs-frontend \
        frontend-install frontend-dev \
        clean-data clean-slate help

## ── Start ────────────────────────────────────────────────────────────────────
up:                    ## Start all services (postgres + qdrant + backend + frontend)
	docker compose up -d --build

up-backend:            ## Start only postgres + qdrant + backend (for frontend-dev workflow)
	docker compose up -d --build postgres qdrant backend

up-frontend:           ## Rebuild and restart frontend container only
	docker compose up -d --build frontend

## ── Stop ─────────────────────────────────────────────────────────────────────
down:                  ## Stop all services
	docker compose down

## ── Build ────────────────────────────────────────────────────────────────────
build:                 ## Rebuild all containers
	docker compose build

build-backend:         ## Rebuild backend container only
	docker compose build backend

build-frontend:        ## Rebuild frontend container only
	docker compose build frontend

## ── Logs ─────────────────────────────────────────────────────────────────────
logs:                  ## Tail logs for all services
	docker compose logs -f

logs-backend:          ## Tail backend logs only
	docker compose logs -f backend

logs-frontend:         ## Tail frontend logs only
	docker compose logs -f frontend

## ── Frontend dev (hot reload outside Docker) ─────────────────────────────────
frontend-install:      ## Install frontend npm dependencies
	cd frontend && npm install

frontend-dev:          ## Run frontend with hot reload (run up-backend first)
	cd frontend && npm run dev

## ── Clean ────────────────────────────────────────────────────────────────────
clean-data:            ## Stop all + remove volumes (fresh DB + Qdrant)
	docker compose down -v

clean-slate:           ## Nuke everything: volumes, images, cache — full rebuild
	docker compose down -v --rmi local
	docker builder prune -f
	docker compose up -d --build

## ── Help ─────────────────────────────────────────────────────────────────────
help:                  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
