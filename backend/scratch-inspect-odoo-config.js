// Diagnóstico standalone: inspecciona lo que la app tiene guardado/desencriptado
// para Odoo, SIN mostrar la apiKey completa. Corre DENTRO del contenedor backend
// (tiene DB_HOST/INTEGRATIONS_ENCRYPT_KEY ya cargados desde .env).
//
//   docker compose exec backend node scratch-inspect-odoo-config.js
//
// Borrar después de usarlo (no commitear):
//   docker compose exec backend rm scratch-inspect-odoo-config.js
//   rm backend/scratch-inspect-odoo-config.js

const { Client } = require('pg');
const crypto = require('crypto');

function decrypt(stored, keyHex) {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  const { rows } = await client.query('SELECT url, db, username, api_key, updated_at FROM odoo_config WHERE id = 1');
  await client.end();

  if (!rows.length) {
    console.log('No hay fila en odoo_config (id=1) — la app está usando fallback de .env, no de lo guardado en la UI.');
    return;
  }
  const row = rows[0];
  console.log('updated_at:', row.updated_at);
  console.log('url      :', JSON.stringify(row.url), `(len=${(row.url || '').length})`);
  console.log('db       :', JSON.stringify(row.db), `(len=${(row.db || '').length})`);
  console.log('username :', JSON.stringify(row.username), `(len=${(row.username || '').length})`);

  const key = process.env.INTEGRATIONS_ENCRYPT_KEY;
  console.log('INTEGRATIONS_ENCRYPT_KEY presente:', !!key, key ? `(len=${key.length}, ¿64 hex?=${/^[0-9a-fA-F]{64}$/.test(key)})` : '');

  if (!row.api_key) {
    console.log('api_key: NULL en DB (nunca se guardó una key real).');
    return;
  }
  try {
    const decrypted = decrypt(row.api_key, key);
    console.log('api_key desencriptada: len =', decrypted.length);
    console.log('  primeros/últimos 2 chars:', JSON.stringify(decrypted.slice(0, 2) + '...' + decrypted.slice(-2)));
    console.log('  ¿tiene espacios/saltos de línea al borde?', decrypted !== decrypted.trim());
  } catch (e) {
    console.log('ERROR al desencriptar api_key:', e.message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
