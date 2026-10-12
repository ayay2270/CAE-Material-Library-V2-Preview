from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

import webview


DEV_ROOT = Path(__file__).resolve().parent
IS_FROZEN = bool(getattr(sys, "frozen", False))
APP_DIR = Path(sys.executable).resolve().parent if IS_FROZEN else DEV_ROOT
BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", DEV_ROOT))

if IS_FROZEN:
    BUNDLED_MATERIALS_JSON = BUNDLE_ROOT / "data" / "materials.json"
    EXTERNAL_MATERIALS_JSON = APP_DIR / "data" / "materials.json"
else:
    REPO_ROOT = DEV_ROOT.parent.parent
    BUNDLED_MATERIALS_JSON = REPO_ROOT / "src" / "data" / "materials.json"
    EXTERNAL_MATERIALS_JSON = BUNDLED_MATERIALS_JSON

HM_PROBE_RESULT = APP_DIR / "hm_probe_result.json"


class MaterialToolboxApi:
    """Offline-first pywebview backend.

    Normal Material Library and Density Tuner functions are fully local.
    HyperMesh integration remains read-only probe / Dry Run.
    """

    def _materials_path(self) -> Path:
        if not IS_FROZEN:
            return EXTERNAL_MATERIALS_JSON

        # First launch: make the embedded database available beside the EXE so
        # the offline PC can later replace/update data/materials.json directly.
        if not EXTERNAL_MATERIALS_JSON.exists():
            EXTERNAL_MATERIALS_JSON.parent.mkdir(parents=True, exist_ok=True)
            if BUNDLED_MATERIALS_JSON.exists():
                EXTERNAL_MATERIALS_JSON.write_bytes(BUNDLED_MATERIALS_JSON.read_bytes())

        if EXTERNAL_MATERIALS_JSON.exists():
            return EXTERNAL_MATERIALS_JSON
        return BUNDLED_MATERIALS_JSON

    def _read_database(self) -> dict:
        path = self._materials_path()
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def get_materials(self):
        return self._read_database()

    def get_runtime_info(self):
        path = self._materials_path()
        return {
            "frozen": IS_FROZEN,
            "app_dir": str(APP_DIR),
            "materials_path": str(path),
            "materials_exists": path.exists(),
        }

    def apply_material_dry_run(self, material_id: str, target: str, solver: str):
        payload = self._read_database()
        material = next(
            (item for item in payload.get("materials", []) if item.get("id") == material_id),
            None,
        )
        if material is None:
            return {"ok": False, "message": "找不到指定材料；HyperMesh 未修改。"}

        density = material.get("density")
        youngs = material.get("youngsModulus")
        poisson = material.get("poissonRatio")
        name = material.get("name", material_id)

        return {
            "ok": True,
            "message": (
                f"Dry Run：準備把 {name} 套用到 {target}（{solver}）。"
                f" ρ={density}, E={youngs} MPa, PR={poisson}。"
                " 目前尚未接 HyperMesh API，因此模型沒有被修改。"
            ),
        }

    def apply_density_dry_run(self, material_id: str, target: str, density: float):
        if not isinstance(density, (int, float)) or density <= 0:
            return {"ok": False, "message": "Density 無效；HyperMesh 未修改。"}

        material_name = "未指定材料"
        if material_id:
            payload = self._read_database()
            material = next(
                (item for item in payload.get("materials", []) if item.get("id") == material_id),
                None,
            )
            if material:
                material_name = material.get("name", material_id)

        return {
            "ok": True,
            "message": (
                f"Dry Run：{material_name} → {target}，"
                f"New Density = {density:.6E}。"
                " 目前只建立 Action Plan，HyperMesh 模型沒有被修改。"
            ),
        }

    def probe_hypermesh_external(self):
        """Read-only compatibility probe from the pywebview Python process."""
        try:
            spec = importlib.util.find_spec("hm")
        except Exception as exc:
            return {
                "available": False,
                "message": f"Unable to inspect hm module: {exc}",
            }

        if spec is None:
            return {
                "available": False,
                "message": (
                    "pywebview 目前使用的 Python 找不到 hm module。"
                    " 這通常代表 Desktop Python 與 HyperMesh 內建 Python 是兩個環境。"
                ),
            }

        try:
            import hm  # type: ignore

            module_path = getattr(hm, "__file__", None) or "(built-in / unknown path)"
            return {
                "available": True,
                "message": (
                    "pywebview Python 可以 import hm。"
                    f" module={module_path}。"
                    " 這一步沒有建立 hm.Model()、沒有修改任何模型。"
                ),
            }
        except Exception as exc:
            return {
                "available": False,
                "message": f"找到 hm module 但 import 失敗：{exc}",
            }

    def read_hm_internal_probe(self):
        if not HM_PROBE_RESULT.exists():
            return {
                "ok": False,
                "message": (
                    "EXE 同資料夾目前沒有 hm_probe_result.json。"
                    " Internal probe 尚未執行或尚未把結果放回此資料夾。"
                ),
            }

        try:
            with HM_PROBE_RESULT.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except Exception as exc:
            return {
                "ok": False,
                "message": f"無法讀取 internal probe 結果：{exc}",
            }

    def open_database_folder(self):
        folder = self._materials_path().parent
        folder.mkdir(parents=True, exist_ok=True)

        if sys.platform.startswith("win"):
            os.startfile(str(folder))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{folder}"')
        else:
            os.system(f'xdg-open "{folder}" >/dev/null 2>&1 &')

        return True


if __name__ == "__main__":
    api = MaterialToolboxApi()
    ui_path = BUNDLE_ROOT / "index.html" if IS_FROZEN else DEV_ROOT / "index.html"

    webview.create_window(
        "CAE Material Toolbox · Material Library + Density Tuner",
        url=str(ui_path),
        js_api=api,
        width=1500,
        height=920,
        min_size=(1120, 720),
    )

    webview.start(debug=not IS_FROZEN)
