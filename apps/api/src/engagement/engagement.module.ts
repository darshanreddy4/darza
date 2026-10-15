import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { EngagementController } from "./engagement.controller";
import { QuestionsController } from "./questions.controller";

@Module({ imports: [ProductsModule], controllers: [EngagementController, QuestionsController] })
export class EngagementModule {}
