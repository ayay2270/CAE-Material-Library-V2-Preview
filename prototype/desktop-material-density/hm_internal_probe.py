from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

RESULT = Path(__file__).resolve().with_name("hm_probe_result.json")

payload = {
    "ok": False,
    "message": "",
    "python": sys.version,
}

try:
    import hm

    # Read-only context test: creating the API model handle should bind to the
    # active HyperMesh model context. This script intentionally performs no
    # entity creation, deletion, or property/material writes.
    model = hm.Model()

    payload.update(
        {
            "ok": True,
            "message": (
                "HyperMesh internal probe succeeded: import hm + hm.Model() worked. "
                "No model entity or solver data was modified."
            ),
            "hm_module": getattr(hm, "__file__", None),
            "model_handle_created": model is not None,
        }
    )
except Exception as exc:
    payload.update(
        {
            "ok": False,
            "message": f"HyperMesh internal probe failed: {exc}",
            "traceback": traceback.format_exc(),
        }
    )

RESULT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(payload, ensure_ascii=False, indent=2))
