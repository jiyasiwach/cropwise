.PHONY: install run test train eval eval-doctor kb fmt

install:
	python3.11 -m venv .venv && ./.venv/bin/pip install -r requirements.txt

run:
	./.venv/bin/uvicorn main:app --reload --port 8000

test:
	./.venv/bin/python tests/test_model.py && ./.venv/bin/python tests/test_api.py && \
	./.venv/bin/python tests/test_plan.py && ./.venv/bin/python tests/test_assistant.py && \
	./.venv/bin/python tests/test_doctor.py

train:
	./.venv/bin/python scripts/train.py

eval:
	./.venv/bin/python eval/run.py

eval-doctor:
	./.venv/bin/python eval/doctor_eval.py && ./.venv/bin/python eval/run.py

kb:
	./.venv/bin/python scripts/build_kb.py
