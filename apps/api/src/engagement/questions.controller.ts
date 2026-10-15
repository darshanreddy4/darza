import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, RequireVerified, Roles, type JwtPayload } from "../auth/auth.guard";
import { ADMIN_AND_STAFF } from "../auth/permissions";
import { MailService } from "../mail/mail.service";
import { questionMail } from "../mail/question-mail";
import { PrismaService } from "../prisma.service";
import { SiteService } from "../site/site.module";
import { AnswerDto, QuestionDto } from "./engagement.dto";

// Keeps one account from flooding the admin's queue.
const MAX_OPEN_PER_USER = 3;

@Controller()
export class QuestionsController {
  private readonly log = new Logger(QuestionsController.name);

  constructor(private prisma: PrismaService, private mail: MailService, private site: SiteService) {}

  // Only answered questions are public.
  @Get("products/:slug/questions")
  async list(@Param("slug") slug: string) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) throw new NotFoundException();
    const rows = await this.prisma.productQuestion.findMany({
      where: { productId: product.id, answer: { not: null } },
      include: { user: { select: { name: true } } },
      orderBy: { answeredAt: "desc" },
      take: 30,
    });
    return rows.map((q) => ({ id: q.id, question: q.question, answer: q.answer, askedAt: q.createdAt, answeredAt: q.answeredAt, author: q.user.name.split(" ")[0] }));
  }

  @Post("products/:slug/questions")
  @UseGuards(AuthGuard)
  @RequireVerified()
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  async ask(@Req() req: { user: JwtPayload }, @Param("slug") slug: string, @Body() dto: QuestionDto) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) throw new NotFoundException();
    const open = await this.prisma.productQuestion.count({ where: { userId: req.user.sub, answer: null } });
    if (open >= MAX_OPEN_PER_USER) throw new BadRequestException("You have a few questions waiting for an answer already. Please wait for those first.");
    await this.prisma.productQuestion.create({ data: { productId: product.id, userId: req.user.sub, question: dto.question.trim() } });
    return { ok: true };
  }

  @Get("admin/questions")
  @UseGuards(AuthGuard)
  @Roles(...ADMIN_AND_STAFF)
  adminList(@Query("status") status?: string) {
    return this.prisma.productQuestion.findMany({
      where: status === "open" ? { answer: null } : status === "answered" ? { answer: { not: null } } : undefined,
      include: { user: { select: { name: true, email: true, phone: true } }, product: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Patch("admin/questions/:id")
  @UseGuards(AuthGuard)
  @Roles(...ADMIN_AND_STAFF)
  async answer(@Param("id") id: string, @Body() dto: AnswerDto) {
    const existing = await this.prisma.productQuestion.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } } });
    if (!existing) throw new NotFoundException();
    const answer = dto.answer.trim();
    const updated = await this.prisma.productQuestion.update({ where: { id }, data: { answer, answeredAt: existing.answeredAt ?? new Date() } });
    // The asker is told once, when the first answer is given.
    if (!existing.answer && existing.user.email) void this.notify(existing, answer);
    return updated;
  }

  @Delete("admin/questions/:id")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles(...ADMIN_AND_STAFF)
  async remove(@Param("id") id: string) {
    await this.prisma.productQuestion.deleteMany({ where: { id } });
  }

  private async notify(q: { id: string; question: string; user: { name: string; email: string | null }; product: { name: string; slug: string } }, answer: string) {
    try {
      await this.mail.send({
        to: q.user.email!,
        ...questionMail({ brand: await this.site.brandName(), name: q.user.name, product: q.product.name, question: q.question, answer, url: `${await this.site.webOrigin()}/products/${q.product.slug}#questions` }),
      });
    } catch (e) {
      this.log.warn(`Could not send the answer email for question ${q.id}: ${(e as Error).message}`);
    }
  }
}
