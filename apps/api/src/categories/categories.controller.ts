import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuthGuard, Permit } from "../auth/auth.guard";
import { CategoryDto } from "./category.dto";
import { validateCategoryParent } from "./category-rules";
import { SearchService } from "../search/search.service";
import { CacheService } from "../cache/cache.service";

@Controller()
export class CategoriesController {
  constructor(private prisma: PrismaService, private search: SearchService, private cache: CacheService) {}

  // Only categories (or parents of categories) that hold published products.
  @Get("categories")
  listPublic() {
    return this.cache.wrap("categories", {}, 60, () => this.loadPublic());
  }

  private async loadPublic() {
    const all = await this.prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
    });
    const counts = new Map(all.map((c) => [c.id, c._count.products]));
    const total = (id: string): number =>
      (counts.get(id) ?? 0) + all.filter((c) => c.parentId === id).reduce((n, c) => n + total(c.id), 0);
    return all
      .map(({ _count, ...c }) => ({ ...c, productCount: total(c.id) }))
      .filter((c) => c.productCount > 0);
  }

  @Get("admin/categories")
  @UseGuards(AuthGuard)
  // The other screens that pick a category (home page, banners, analytics) read this list too.
  @Permit("products.view", "categories.manage", "content.manage", "analytics.view")
  listAll() {
    return this.prisma.category.findMany({ orderBy: { name: "asc" } });
  }

  @Post("admin/categories")
  @UseGuards(AuthGuard)
  @Permit("categories.manage")
  create(@Body() dto: CategoryDto) {
    return this.save(undefined, dto);
  }

  @Put("admin/categories/:id")
  @UseGuards(AuthGuard)
  @Permit("categories.manage")
  update(@Param("id") id: string, @Body() dto: CategoryDto) {
    return this.save(id, dto);
  }

  @Delete("admin/categories/:id")
  @UseGuards(AuthGuard)
  @Permit("categories.manage")
  async remove(@Param("id") id: string) {
    const removed = await this.prisma.category.delete({ where: { id } }).catch(mapError);
    await this.cache.invalidate();
    return removed;
  }

  private async save(id: string | undefined, dto: CategoryDto) {
    const parentId = dto.parentId || null;
    const [parent, childCount] = await Promise.all([
      parentId ? this.prisma.category.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } }) : null,
      id ? this.prisma.category.count({ where: { parentId: id } }) : 0,
    ]);
    if (id && !(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException();
    const problem = validateCategoryParent({ id, parentId, parent, childCount });
    if (problem) throw new BadRequestException(problem);

    const data = { name: dto.name, slug: dto.slug, parentId };
    const saved = await (id ? this.prisma.category.update({ where: { id }, data }) : this.prisma.category.create({ data })).catch(mapError);
    // Category names and slugs are part of each product's search document.
    if (id) this.search.reindexAll().catch(() => {});
    await this.cache.invalidate();
    return saved;
  }
}

function mapError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") throw new ConflictException("A category with this slug already exists");
    if (e.code === "P2003") throw new ConflictException("Category still has products or subcategories");
  }
  throw e;
}
