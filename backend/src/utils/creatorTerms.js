// YNeet Creator Terms: which version each creator has accepted, and when.
// New creators accept when they apply; existing creators accept from their
// dashboard before their next upload. Bump TERMS_VERSION when the terms change
// (and update frontend/src/pages/creator/CreatorTermsPage.jsx to match).
//
// Stored in its own Postgres schema, "creator_terms" (plain SQL, not in
// prisma/schema.prisma, so `prisma db push` never touches it).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TERMS_VERSION = "2026-11-03";

let ready = null;
function ensureTable() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS creator_terms`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS creator_terms.acceptances (
        creator_id  TEXT NOT NULL,
        version     TEXT NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip          TEXT,
        PRIMARY KEY (creator_id, version)
      )`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

async function hasAccepted(creatorId) {
  await ensureTable();
  const rows = await prisma.$queryRaw`SELECT 1 FROM creator_terms.acceptances WHERE creator_id = ${creatorId} AND version = ${TERMS_VERSION}`;
  return rows.length > 0;
}

async function accept(creatorId, ip) {
  await ensureTable();
  await prisma.$executeRaw`INSERT INTO creator_terms.acceptances (creator_id, version, ip) VALUES (${creatorId}, ${TERMS_VERSION}, ${ip || null}) ON CONFLICT DO NOTHING`;
}

module.exports = { TERMS_VERSION, hasAccepted, accept };
