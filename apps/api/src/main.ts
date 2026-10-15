import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConsoleLogger, Logger, ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { assertProductionConfig } from "./config/config-check";
import { ErrorReporter } from "./observability/error-reporter";
import { webOrigins } from "./auth/session-cookie";
import { UPLOAD_DIR } from "./storage/storage.service";

async function bootstrap() {
  assertProductionConfig();
  // LOG_FORMAT=json prints one JSON object per line, which log tools such as Datadog, Loki or CloudWatch can search.
  const logger = new ConsoleLogger({ json: process.env.LOG_FORMAT === "json", colors: process.env.LOG_FORMAT !== "json" });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, logger });
  // Lets a restart or scale-down finish running requests and close the database connection.
  app.enableShutdownHooks();
  app.useGlobalFilters(new ErrorReporter(app.get(HttpAdapterHost).httpAdapter));
  // Behind a load balancer or reverse proxy, every request would otherwise appear to come from the proxy, and the rate limits would treat all visitors as one.
  // TRUST_PROXY is how many proxies sit in front of the API (usually 1).
  const hops = Number(process.env.TRUST_PROXY ?? 0);
  if (hops > 0) app.set("trust proxy", hops);
  else if (process.env.NODE_ENV === "production") new Logger("Security").warn("TRUST_PROXY is not set. If the API runs behind a proxy or load balancer, set it to the number of proxies so rate limits see real visitor addresses.");
  // Uploaded images are embedded by the web app on another origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  // credentials: the session lives in an httpOnly cookie that the web app sends with every request.
  app.enableCors({ origin: webOrigins(), credentials: true });
  // With bucket storage, /uploads/<name> is answered by a redirect instead.
  if (process.env.STORAGE_DRIVER !== "s3") app.useStaticAssets(UPLOAD_DIR, { prefix: "/uploads", maxAge: "7d", index: false });
  // Product imports arrive as the CSV text itself, which can be larger than a normal request.
  app.useBodyParser("text", { type: "text/csv", limit: "3mb" });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
