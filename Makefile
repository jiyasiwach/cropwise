.PHONY: install run test train train-yield eval eval-doctor kb fmt ui ui-dev ui-test

install:
	python3.11 -m venv .venv && ./.venv/bin/pip install -r requirements.txt

run:
	./.venv/bin/uvicorn main:app --reload --port 8000

test:
	./.venv/bin/python tests/test_model.py && ./.venv/bin/python tests/test_api.py && \
	./.venv/bin/python tests/test_plan.py && ./.venv/bin/python tests/test_assistant.py && \
	./.venv/bin/python tests/test_doctor.py && ./.venv/bin/python tests/test_features.py

train:
	./.venv/bin/python scripts/train.py

# Needs the two DES crop-statistics CSVs (see data/yield/SOURCE.json): make train-yield DATA=path/to/folder
train-yield:
	./.venv/bin/python scripts/train_yield.py $(DATA)

eval:
	./.venv/bin/python eval/run.py

eval-doctor:
	./.venv/bin/python eval/doctor_eval.py && ./.venv/bin/python eval/run.py

kb:
	./.venv/bin/python scripts/build_kb.py

ui:
	cd web && npm ci && npm run build

ui-dev:
	cd web && npm run dev

ui-test:
	cd web && npm test

