// Single shared PrismaClient instance (avoids exhausting connections on reload).
//
// When DATABASE_URL is a Prisma Postgres / Accelerate URL (`prisma+postgres://`
// or `prisma://`, e.g. the one Vercel injects), the client is extended with
// Accelerate (required for that pooled connection to work). For a plain
// `postgresql://` URL (local dev), it's a normal client — no change.
// Client is generated into ../generated/prisma (see prisma/schema.prisma) and
// shipped in the deploy zip, so the host never has to run `prisma generate`.
const { PrismaClient } = require('../generated/prisma');

function createClient() {
  const base = new PrismaClient();
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('prisma+postgres://') || url.startsWith('prisma://')) {
    const { withAccelerate } = require('@prisma/extension-accelerate');
    return base.$extends(withAccelerate());
  }
  return base;
}

const prisma = global._prisma || createClient();
if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

module.exports = prisma;
