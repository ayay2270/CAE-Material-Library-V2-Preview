from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

import webview


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
MATERIALS_JSON = REPO_ROOT / "src" / "data" / "materials.json"
HM_PROBE_RESULT = ROOT / "hm_probe_result.json"


class MaterialToolboxApi:
    """Safe pywebview proof-of-concept.

    This bridge reads the existing materials.json and exposes Desktop-only actions.
    It does NOT modify HyperMesh yet. Apply buttons are intentionally Dry Run.
    """

    def _read_database(self) -> dict:
        with MATERIALS_JSON.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def get_materials(self):
        payload = self._read_database()
        return payload

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
        """Read-only compatibility probe from the pywebview Python process.

        This intentionally does not call hm.Model() and does not modify a model.
        It only checks whether the external Python environment can see/import hm.
        """
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
                    " 這很常見，代表 Desktop Python 與 HyperMesh 內建 Python 是兩個環境；"
                    " 下一步應測 HyperMesh 內部 probe，而不是硬接。"
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
                    " 這一步沒有建立 hm.Model()、沒有改任何模型。"
                ),
            }
        except Exception as exc:
            return {
                "available": False,
                "message": f"找到 hm module 但 import 失敗：{exc}",
            }

    def read_hm_internal_probe(self):
        """Read result produced by hm_internal_probe.py inside HyperMesh."""
        if not HM_PROBE_RESULT.exists():
            return {
                "ok": False,
                "message": (
                    "還沒有 hm_probe_result.json。"
                    " 請在支援的 HyperMesh 環境中執行同資料夾的 hm_internal_probe.py；"
                    " 它只測 import hm + hm.Model()，不修改模型。"
                ),
            }

        try:
            with HM_PROBE_RESULT.open("r", encoding="utf-8") as handle:
                result = json.load(handle)
            return result
        except Exception as exc:
            return {
                "ok": False,
                "message": f"無法讀取 internal probe 結果：{exc}",
            }

    def open_database_folder(self):
        folder = str(MATERIALS_JSON.parent)

        if sys.platform.startswith("win"):
            os.startfile(folder)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{folder}"')
        else:
            os.system(f'xdg-open "{folder}" >/dev/null 2>&1 &')

        return True


if __name__ == "__main__":
    api = MaterialToolboxApi()

    webview.create_window(
        "CAE Material Toolbox · Material Library + Density Tuner",
        url=str(ROOT / "index.html"),
        js_api=api,
        width=1500,
        height=920,
        min_size=(1120, 720),
    )

    webview.start(debug=True)
