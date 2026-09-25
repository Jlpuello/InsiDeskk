import type { Prisma, RemotelyScriptExecution } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

export class ScriptExecutionRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.RemotelyScriptExecutionCreateInput): Promise<RemotelyScriptExecution> {
    return this.prisma.remotelyScriptExecution.create({ data });
  }

  async findByDeviceId(dispositivoId: string) {
    return this.prisma.remotelyScriptExecution.findMany({
      where: { dispositivoId },
      orderBy: { createdAt: 'desc' },
      include: { usuario: { select: safeUserSelect } },
    });
  }
}

export const scriptExecutionRepository = new ScriptExecutionRepository();
