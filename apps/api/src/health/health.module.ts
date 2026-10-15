import { Controller, Get, Module, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage/storage.service";

// For load balancers and uptime monitors: /health says the process is up, /health/ready says it can reach what it needs.
@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  @Get()
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    const checks: Record<string, "ok" | "failed"> = { database: "ok", storage: "ok" };
    await this.prisma.$queryRaw`SELECT 1`.catch(() => { checks.database = "failed"; });
    await this.storage.check().catch(() => { checks.storage = "failed"; });
    if (Object.values(checks).includes("failed")) throw new ServiceUnavailableException({ status: "unavailable", checks });
    return { status: "ok", checks };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
