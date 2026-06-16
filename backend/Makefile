dev:
	uvicorn app.main:asgi_app --reload --port 8000

seed:
	python scripts/seed_scales.py \
		--scales-dir ../../data/scales \
		--conditions-file ../../data/conditionMap.json

test:
	pytest tests/ -v

lint:
	ruff check app/

install:
	pip install -r requirements.txt
