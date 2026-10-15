import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Role } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../audit/audit-log.service";
import { describeAction } from "../audit/audit-describe";
import { isTrustedOrigin, readSessionCookie } from "./session-cookie";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const ANONYMOUS_KEY = "allowAnonymous";
// For routes that answer differently for guests; they get through with req.user unset instead of a 401. A bad session is still refused.
// "soft" also lets a stale or invalid session through as a guest, for pages that only personalise.
export const AllowAnonymous = (mode: true | "soft" = true) => SetMetadata(ANONYMOUS_KEY, mode);

export const VERIFIED_KEY = "requireVerified";
// Marks a route that needs a confirmed email address, e.g. placing orders or writing reviews.
export const RequireVerified = () => SetMetadata(VERIFIED_KEY, true);

export interface JwtPayload {
  sub: string;
  role: Role;
  // Must match User.tokenVersion, so a password change signs out older sessions.
  tv: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private prisma: PrismaService, private audit: AuditService) {}

  async canActivate(ctx: ExecutionContext) {
    try {
      return await this.check(ctx);
    } catch (e) {
      const soft = this.reflector.getAllAndOverride<true | "soft" | undefined>(ANONYMOUS_KEY, [ctx.getHandler(), ctx.getClass()]) === "soft";
      if (soft && (e instanceof UnauthorizedException || e instanceof ForbiddenException)) return true;
      throw e;
    }
  }

  private async check(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = readSessionCookie(req);
    if (!token) {
      if (this.reflector.getAllAndOverride<boolean | undefined>(ANONYMOUS_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
      throw new UnauthorizedException();
    }
    if (!isTrustedOrigin(req)) throw new ForbiddenException("Request blocked: untrusted origin");

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    // Role and session validity come from the database so demotions and password changes apply immediately.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true, tokenVersion: true, emailVerifiedAt: true, phoneVerifiedAt: true } });
    if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedException();
    req.user = { sub: payload.sub, role: user.role, tv: user.tokenVersion } satisfies JwtPayload;

    if (this.reflector.getAllAndOverride<boolean | undefined>(VERIFIED_KEY, [ctx.getHandler(), ctx.getClass()]) && !(user.emailVerifiedAt || user.phoneVerifiedAt)) {
      throw new ForbiddenException({ statusCode: 403, code: "EMAIL_NOT_VERIFIED", message: "Please verify your email address first. We sent you a link when you signed up." });
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) {
      // The audit interceptor never sees a request the guard turns away, so an attempt to change something is noted here.
      const entry = describeAction({ method: req.method, routePath: req.route?.path ?? "", params: req.params, body: req.body, query: req.query });
      if (entry) void this.audit.record(req.user, { ...entry, action: `${entry.action}.blocked`, summary: `Blocked: ${entry.summary.charAt(0).toLowerCase()}${entry.summary.slice(1)}` });
      throw new ForbiddenException();
    }
    return true;
  }
}
