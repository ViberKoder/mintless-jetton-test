import { execSync } from 'node:child_process';

const port = process.env.PORT || '3000';

console.log('Applying database schema...');
execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env });

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
