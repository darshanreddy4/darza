import { Module } from "@nestjs/common";
import { SearchModule } from "../search/search.module";
import { ProductsController } from "./products.controller";
import { ProductImportService } from "./product-import.service";
import { ProductsService } from "./products.service";

@Module({ imports: [SearchModule], controllers: [ProductsController], providers: [ProductsService, ProductImportService], exports: [ProductsService] })
export class ProductsModule {}
