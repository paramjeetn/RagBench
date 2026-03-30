.PHONY: up down build logs logs-backend logs-frontend seed frontend-dev clean-data clean-slate help

up:                    ## Start all services (backend + frontend + db)
	docker compose up -d --build

down:                  ## Stop all services
	docker compose down

build:                 ## Rebuild all containers
	docker compose build

logs:                  ## Tail logs for all services
	docker compose logs -f

logs-backend:          ## Tail backend logs only
	docker compose logs -f backend

logs-frontend:         ## Tail frontend logs only
	docker compose logs -f frontend

seed:                  ## Re-run seed data loader
	docker compose run --rm seed

frontend-dev:          ## Run frontend in dev mode (outside Docker)
	cd frontend && npm run dev

clean-data:                 ## Stop all + remove volumes (fresh start)
	docker compose down -v

clean-slate:           ## Nuke everything: volumes, images, cache — full rebuild
	docker compose down -v --rmi local
	docker builder prune -f
	docker compose up -d --build

help:                  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
