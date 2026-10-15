import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { HomeController } from "./home.controller";
import { HomeService } from "./home.service";

@Module({ imports: [ProductsModule], controllers: [HomeController], providers: [HomeService] })
export class HomeModule {}
