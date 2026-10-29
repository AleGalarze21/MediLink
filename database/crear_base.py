"""
Crea (o recrea) la base medilink.db a partir de schema.sql y seed.sql.
No hace falta tener instalado SQLite aparte: Python ya lo incluye.

Uso (desde la carpeta database/):
    python crear_base.py            # crea la base
    python export_data.py           # y actualiza los datos que lee la web/móvil
"""
import sqlite3
from pathlib import Path

AQUI = Path(__file__).resolve().parent
DB = AQUI / "medilink.db"

if DB.exists():
    DB.unlink()

con = sqlite3.connect(DB)
con.execute("PRAGMA foreign_keys = ON")
con.executescript((AQUI / "schema.sql").read_text(encoding="utf-8"))
con.executescript((AQUI / "seed.sql").read_text(encoding="utf-8"))
con.commit()

for tabla in ("especialidades", "centros", "horarios_centro",
              "profesionales", "profesional_centro", "opiniones"):
    n = con.execute(f"SELECT COUNT(*) FROM {tabla}").fetchone()[0]
    print(f"{tabla:20} {n} registros")
print("Base creada en", DB)
