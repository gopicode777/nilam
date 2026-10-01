.PHONY: setup api web test build
setup:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && cp -n .env.example .env
	cd client && npm install
api:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8080
web:
	cd client && npm run dev
test:
	cd backend && .venv/bin/python -m pytest -q
build:
	cd client && npm run build
