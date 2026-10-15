import { CallHandler, Controller, ExecutionContext, Get, Global, HttpException, Injectable, Module, NestInterceptor, Query, UseGuards } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { Observable, tap } from "rxjs";
import { AuthGuard, Roles, type JwtPayload } from "../auth/auth.guard";
import { describeAction } from "./audit-describe";
import { AuditService } from "./audit-log.service";

// Writes a line for every change made in the admin area, with who made it. Rejected attempts inside a handler are noted too.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== "http") return next.handle();
    const req = ctx.switchToHttp().getRequest<{ method: string; route?: { path?: string }; params: Record<string, string>; body: unknown; query: Record<string, unknown>; user?: { sub: string; role: Role; tv: number } }>();
    const entry = req.user && req.route?.path ? describeAction({ method: req.method, routePath: req.route.path, params: req.params, body: req.body, query: req.query }) : null;
    if (!entry) return next.handle();
    const actor = req.user as JwtPayload;
    return next.handle().pipe(tap({
      next: () => void this.audit.record(actor, entry),
      error: (e) => { if (e instanceof HttpException && e.getStatus() === 403) void this.audit.record(actor, { ...entry, action: `${entry.action}.blocked`, summary: `Blocked: ${entry.summary.charAt(0).toLowerCase()}${entry.summary.slice(1)}` }); },
    }));
  }
}

@Controller("admin/audit-log")
@UseGuards(AuthGuard)
@Roles("ADMIN")
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@Query("actorId") actorId?: string, @Query("entity") entity?: string, @Query("before") before?: string, @Query("limit") limit?: string) {
    return this.audit.list({ actorId: actorId?.slice(0, 40), entity: entity?.slice(0, 40), before, limit: limit ? Number(limit) || undefined : undefined });
  }
}

@Global()
@Module({ controllers: [AuditController], providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }], exports: [AuditService] })
export class AuditModule {}
