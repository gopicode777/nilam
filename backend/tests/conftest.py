import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ.update(DATA_DIR=_tmp, DATABASE_URL=f"sqlite:///{_tmp}/test.db", ENV="development", ANTHROPIC_API_KEY="")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
