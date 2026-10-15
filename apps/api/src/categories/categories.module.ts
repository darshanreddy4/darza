import { Module } from "@nestjs/common";
import { SearchModule } from "../search/search.module";
import { CategoriesController } from "./categories.controller";

@Module({ imports: [SearchModule], controllers: [CategoriesController] })
export class CategoriesModule {}
