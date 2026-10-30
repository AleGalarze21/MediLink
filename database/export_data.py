"""
Exporta los datos de medilink.db a shared/js/data.js
para que la web y el móvil lean la información de la base.

Uso (desde la carpeta database/):
    python export_data.py
"""
import json
import sqlite3
from pathlib import Path

AQUI = Path(__file__).resolve().parent
DB = AQUI / "medilink.db"
SALIDA = AQUI.parent / "shared" / "js" / "data.js"

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row

centros = []
for c in con.execute("SELECT * FROM centros ORDER BY id"):
    horarios = [
        {
            "l": h["etiqueta"],
            "d": [int(x) for x in h["dias"].split(",")],
            "f": h["hora_desde"],
            "t": h["hora_hasta"],
            "x": h["texto"],
        }
        for h in con.execute(
            "SELECT * FROM horarios_centro WHERE centro_id = ? ORDER BY id", (c["id"],)
        )
    ]
    centros.append({
        "id": c["id"], "name": c["nombre"], "addr": c["direccion"],
        "city": c["ciudad"], "phone": c["telefono"],
        "hours": horarios, "note": c["nota"] or "",
    })

profesionales = []
for p in con.execute(
    """SELECT p.*, e.nombre AS especialidad
       FROM profesionales p JOIN especialidades e ON e.id = p.especialidad_id
       ORDER BY p.id"""
):
    centros_ids = [r[0] for r in con.execute(
        "SELECT centro_id FROM profesional_centro WHERE profesional_id = ? ORDER BY centro_id",
        (p["id"],))]
    opiniones = [
        {"a": o["autor"], "r": o["puntaje"], "t": o["comentario"], "d": o["fecha"], "verified": bool(o["turno_id"]) if "turno_id" in o.keys() else False}
        for o in con.execute(
            "SELECT * FROM opiniones WHERE profesional_id = ? ORDER BY fecha DESC, id DESC",
            (p["id"],))
    ]
    profesionales.append({
        "id": p["id"], "name": p["nombre"], "spec": p["especialidad"],
        "city": p["ciudad"], "hosps": centros_ids, "exp": p["anios_experiencia"],
        "bg": p["color"], "verified": bool(p["verificado"]), "reviews": opiniones,
    })

SALIDA.write_text(
    "// Archivo GENERADO desde database/medilink.db — no editar a mano.\n"
    "// Para actualizarlo: cd database && python export_data.py\n"
    f"let H = {json.dumps(centros, ensure_ascii=False, indent=1)};\n\n"
    f"let P = {json.dumps(profesionales, ensure_ascii=False, indent=1)};\n",
    encoding="utf-8",
)
print(f"OK: {len(centros)} centros, {len(profesionales)} profesionales -> {SALIDA}")
