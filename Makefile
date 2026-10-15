.PHONY: install run test train fmt

install:
	python3.11 -m venv .venv && ./.venv/bin/pip install -r requirements.txt

run:
	./.venv/bin/uvicorn main:app --reload --port 8000

test:
	./.venv/bin/python tests/test_model.py && ./.venv/bin/python tests/test_api.py && ./.venv/bin/python tests/test_plan.py

train:
	./.venv/bin/python scripts/train.py
