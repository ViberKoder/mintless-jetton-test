import { execSync } from 'node:child_process';

const port = process.env.PORT || '3000';

/** Drop duplicate minterAddress rows (keep newest) so @unique can be applied. */
async function dedupeMinterAddresses() {
    try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const result = await prisma.$executeRaw`
            DELETE FROM "Jetton" a
            USING "Jetton" b
            WHERE a."minterAddress" IS NOT NULL
              AND a."minterAddress" = b."minterAddress"
              AND a."createdAt" < b."createdAt"
        `;
        if (result > 0) {
            console.log(`Removed ${result} duplicate jetton row(s) by minterAddress`);
        }
        await prisma.$disconnect();
    } catch (e) {
        console.warn('Duplicate minterAddress cleanup skipped:', e?.message ?? e);
    }
}

await dedupeMinterAddresses();

console.log('Applying database schema...');
// --accept-data-loss: required when adding @unique on minterAddress (existing Railway DBs)
execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
});

try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const removed = await prisma.jetton.deleteMany({ where: { minterAddress: null } });
    if (removed.count > 0) {
        console.log(`Removed ${removed.count} legacy jetton row(s) without minterAddress`);
    }
    await prisma.$disconnect();
} catch (e) {
    console.warn('Legacy cleanup skipped:', e?.message ?? e);
}

console.log(`Starting Next.js on 0.0.0.0:${port}`);
execSync(`npx next start -H 0.0.0.0 -p ${port}`, { stdio: 'inherit', env: process.env });
