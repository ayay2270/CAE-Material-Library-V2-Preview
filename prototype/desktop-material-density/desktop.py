from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import webview


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
MATERIALS_JSON = REPO_ROOT / "src" / "data" / "materials.json"


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
