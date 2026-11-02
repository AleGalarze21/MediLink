import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.MEDILINK_DB_PATH || path.join(root, "database", "medilink.db");
const [emailInput, ...nameParts] = process.argv.slice(2);
const email = String(emailInput || "").trim().toLowerCase();
const name = nameParts.join(" ").trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 100) {
  console.error("Uso: npm run create:admin -- correo@dominio.com Nombre Apellido");
  process.exit(1);
}

const password = crypto.randomBytes(24).toString("base64url");
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 310_000, 32, "sha256");
const db = new DatabaseSync(dbPath);
try {
  const result = db.prepare("INSERT INTO usuarios(nombre,email,password_hash,password_salt,rol) VALUES(?,?,?,?,'admin')")
    .run(name, email, hash.toString("hex"), salt.toString("hex"));
  console.log(`Administrador creado (ID ${result.lastInsertRowid}, ${email}).`);
  console.log(`Contraseña inicial de un solo uso: ${password}`);
  console.log("Guardala ahora y cambiá la contraseña después del primer ingreso.");
} catch (error) {
  if (/UNIQUE constraint failed/i.test(error.message)) console.error("Ya existe una cuenta con ese correo.");
  else throw error;
  process.exitCode = 1;
} finally { db.close(); }
