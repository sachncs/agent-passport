.DEFAULT_GOAL := help

help:
	@printf '%s\n' 'Agent Passport development commands:'
	@printf '%s\n' '  make setup       Install locked dependencies'
	@printf '%s\n' '  make check       Run lint, types, tests, and release checks'
	@printf '%s\n' '  make build       Build API, SDK, console, and site'
	@printf '%s\n' '  make docker-up   Start the production-style local container'
	@printf '%s\n' '  make docker-down Stop the local container'

setup:
	npm ci
	npm ci --prefix site

check:
	npm run lint
	npm run typecheck:all
	npm test -- --coverage
	npm run release:check

build:
	npm run build:all

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down
