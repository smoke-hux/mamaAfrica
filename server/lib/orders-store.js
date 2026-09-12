/**
 * Order persistence: a JSON array on disk (ORDERS_FILE env or server/data/orders.json).
 * Writes are serialised and atomic (temp file + rename); the file is created on first write.
 */
import { promises as fs, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ORDERS_FILE = path.resolve(
  process.env.ORDERS_FILE || path.join(__dirname, '..', 'data', 'orders.json'),
);

/** @type {Array<object>} */
let orders = load();
let writeChain = Promise.resolve();

function load() {
  try {
    if (!existsSync(ORDERS_FILE)) return [];
    const parsed = JSON.parse(readFileSync(ORDERS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[orders] Could not read ${ORDERS_FILE}, starting empty: ${err.message}`);
    return [];
  }
}

async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

function persist() {
  const snapshot = JSON.stringify(orders, null, 2) + '\n';
  writeChain = writeChain.catch(() => {}).then(() => atomicWrite(ORDERS_FILE, snapshot));
  return writeChain;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function newOrderId() {
  let id;
  do {
    id = 'MAM-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  } while (orders.some((o) => o.id === id));
  return id;
}

export function getOrder(id) {
  const key = String(id || '').trim().toUpperCase();
  return orders.find((o) => o.id === key) || null;
}

export async function saveOrder(order) {
  orders.push(order);
  await persist();
  return order;
}

export function allOrders() {
  return orders;
}
