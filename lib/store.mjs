import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const decode = (row) => row ? JSON.parse(row.data) : null;
const alive = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
};

/** Small synchronous SQLite repository. JSON records preserve immutable snapshots.
 * All mutation callbacks are synchronous; never keep a SQLite transaction open
 * across a provider request. The persisted lease instead guards that interval.
 */
export function createStore(path, initialListings = []) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
      listing_id TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
      review_id TEXT NOT NULL UNIQUE, listing_id TEXT NOT NULL, capture_id TEXT UNIQUE,
      paypal_id TEXT UNIQUE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leases (listing_id TEXT PRIMARY KEY, owner TEXT NOT NULL,
      pid INTEGER NOT NULL, expires_at INTEGER NOT NULL);`);
  const leasesOwned = new Set();
  const transaction = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const listing = (id) => decode(db.prepare('SELECT data FROM listings WHERE id=?').get(id));
  const review = (id) => decode(db.prepare('SELECT data FROM reviews WHERE id=?').get(id));
  const order = (id) => decode(db.prepare('SELECT data FROM orders WHERE id=?').get(id));
  const saveListing = (value) => db.prepare('INSERT INTO listings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(value.id, JSON.stringify(value));
  const saveReview = (value) => db.prepare('INSERT INTO reviews(id,session_id,listing_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(value.id, value.sessionId, value.listingId, JSON.stringify(value));
  const saveOrder = (value) => db.prepare('INSERT INTO orders(id,session_id,review_id,listing_id,capture_id,paypal_id,data) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET capture_id=excluded.capture_id,paypal_id=excluded.paypal_id,data=excluded.data').run(value.id, value.sessionId, value.reviewId, value.listingId, value.captureId, value.paypalOrderId, JSON.stringify(value));
  const activeLease = (id) => {
    const lease = db.prepare('SELECT * FROM leases WHERE listing_id=?').get(id);
    return lease && lease.expires_at > Date.now() && alive(lease.pid) ? lease : null;
  };
  transaction(() => {
    for (const item of initialListings) {
      db.prepare('INSERT OR IGNORE INTO listings(id,data) VALUES(?,?)').run(item.id, JSON.stringify(item));
    }
    for (const row of db.prepare('SELECT data FROM orders').all()) {
      const value = decode(row);
      if (['creating', 'capture_in_progress'].includes(value.status) && !activeLease(value.listingId)) {
        value.status = 'ambiguous';
        value.message = value.captureRequestId
          ? 'The server stopped during capture. Payment may have completed. Check PayPal status before any further purchase.'
          : 'The server stopped while creating the sandbox order. Its outcome is unknown; a safe retry must use the saved request ID.';
        value.updatedAt = new Date().toISOString();
        saveOrder(value);
      }
    }
  });
  return {
    transaction, listing, review, order, saveListing, saveReview, saveOrder,
    listings: () => db.prepare('SELECT data FROM listings ORDER BY rowid').all().map(decode),
    orderForReview: (id) => decode(db.prepare('SELECT data FROM orders WHERE review_id=?').get(id)),
    ordersForListing: (id) => db.prepare('SELECT data FROM orders WHERE listing_id=?').all(id).map(decode),
    acquireLease(id, owner, durationMs = 120_000) {
      return transaction(() => {
        if (activeLease(id)) return false;
        db.prepare('INSERT INTO leases(listing_id,owner,pid,expires_at) VALUES(?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET owner=excluded.owner,pid=excluded.pid,expires_at=excluded.expires_at').run(id, owner, process.pid, Date.now() + durationMs);
        leasesOwned.add(owner);
        return true;
      });
    },
    assertLease(id, owner) { return activeLease(id)?.owner === owner; },
    releaseLease(id, owner) {
      db.prepare('DELETE FROM leases WHERE listing_id=? AND owner=?').run(id, owner);
      leasesOwned.delete(owner);
    },
    close() {
      for (const owner of leasesOwned) db.prepare('DELETE FROM leases WHERE owner=?').run(owner);
      db.close();
    },
  };
}
