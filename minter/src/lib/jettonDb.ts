import { prisma } from '@/lib/db';
import { masterFromPath } from '@/lib/master';

export async function findJettonByMasterParam(masterParam: string) {
    const master = masterFromPath(masterParam);
    const raw = master.toRawString();
    const friendly = master.toString({ bounceable: true, urlSafe: true });

    return prisma.jetton.findFirst({
        where: {
            OR: [{ minterAddress: raw }, { minterAddress: friendly }],
        },
    });
}
