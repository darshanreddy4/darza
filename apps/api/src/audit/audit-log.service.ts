import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { JwtPayload } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import type { AuditEntry } from "./audit-describe";

const PAGE = 50;

@Injectable()
export class AuditService {
  private readonly log = new Logger("Audit");

  constructor(private prisma: PrismaService) {}

  // Never throws: a logging problem must not undo or block the change that was just made.
  async record(actor: JwtPayload, entry: AuditEntry) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { name: true } });
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.sub, actorName: user?.name ?? "Unknown", actorRole: actor.role, action: entry.action, summary: entry.summary,
          entity: entry.entity, entityId: entry.entityId, details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (e) {
      this.log.error(`Could not write the audit log: ${(e as Error).message}`);
    }
  }

  async list(q: { actorId?: string; entity?: string; before?: string; limit?: number }) {
    const before = q.before && !isNaN(Date.parse(q.before)) ? new Date(q.before) : undefined;
    const take = Math.min(Math.max(q.limit ?? PAGE, 1), 200);
    const rows = await this.prisma.auditLog.findMany({
      where: { ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.entity ? { entity: q.entity } : {}), ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: "desc" },
      take: take + 1,
    });
    const items = rows.slice(0, take);
    const [actors, entities] = await Promise.all([
      this.prisma.auditLog.groupBy({ by: ["actorId", "actorName"], _max: { createdAt: true }, orderBy: { _max: { createdAt: "desc" } }, take: 50 }),
      this.prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, where: { entity: { not: null } }, take: 50 }),
    ]);
    return {
      items,
      nextBefore: rows.length > take ? items[items.length - 1].createdAt.toISOString() : null,
      actors: actors.map((a) => ({ id: a.actorId, name: a.actorName })),
      entities: entities.map((e) => e.entity).filter(Boolean).sort(),
    };
  }
}
