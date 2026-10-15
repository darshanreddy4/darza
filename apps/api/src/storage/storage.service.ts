import { Global, Injectable, Logger, Module } from "@nestjs/common";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rename, stat, writeFile } from "fs/promises";
import { dirname, join } from "path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

// Keys are our own generated names, optionally under .cache/; nothing else may reach the disk or the bucket.
const KEY = /^(\.cache\/)?[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;
export const isSafeKey = (key: string) => KEY.test(key) && !key.includes("..");

const isMissing = (e: unknown) => {
  const x = e as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  return x.code === "ENOENT" || x.name === "NoSuchKey" || x.name === "NotFound" || x.$metadata?.httpStatusCode === 404;
};

// Where uploaded pictures and videos live: the server's disk (STORAGE_DRIVER=local, the default) or any S3-compatible
// bucket (STORAGE_DRIVER=s3: AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, MinIO, Wasabi...).
@Injectable()
export class StorageService {
  private readonly log = new Logger("Storage");
  readonly driver: "local" | "s3" = process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
  private readonly bucket = process.env.S3_BUCKET ?? "";
  private readonly prefix = (process.env.S3_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
  private readonly s3 = this.driver === "s3"
    ? new S3Client({
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        // Without keys the SDK uses the host's own identity (an instance or task role).
        credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } : undefined,
      })
    : null;

  constructor() {
    if (this.driver === "local" && process.env.NODE_ENV === "production") {
      this.log.warn(`Uploads are saved on this server's disk (${UPLOAD_DIR}). Mount a persistent volume there, or set STORAGE_DRIVER=s3 to use a bucket.`);
    }
    if (this.driver === "s3" && !this.bucket) this.log.error("STORAGE_DRIVER=s3 needs S3_BUCKET");
  }

  private objectKey(key: string) {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    if (!isSafeKey(key)) throw new Error("Unsafe storage key");
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key), Body: data, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
      return;
    }
    const path = join(UPLOAD_DIR, key);
    await mkdir(dirname(path), { recursive: true });
    // Written under another name first, so nobody is ever sent a half-written file.
    const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, path);
  }

  async get(key: string): Promise<Buffer | null> {
    if (!isSafeKey(key)) return null;
    try {
      if (this.s3) {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
        return Buffer.from(await res.Body!.transformToByteArray());
      }
      return await readFile(join(UPLOAD_DIR, key));
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!isSafeKey(key)) return false;
    try {
      if (this.s3) await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
      else if (!(await stat(join(UPLOAD_DIR, key))).isFile()) return false;
      return true;
    } catch (e) {
      if (isMissing(e)) return false;
      throw e;
    }
  }

  // Bucket mode only: where a browser can fetch the original. A public bucket or CDN (STORAGE_PUBLIC_URL) is used as it is,
  // otherwise a temporary signed link is made.
  async originalUrl(key: string): Promise<string | null> {
    if (!this.s3 || !isSafeKey(key)) return null;
    const base = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, "");
    if (base) return `${base}/${this.objectKey(key)}`;
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }), { expiresIn: 3600 });
  }

  // For the readiness check: can the bucket or the folder be reached?
  async check(): Promise<void> {
    if (this.s3) {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey("health-check") })).catch((e) => { if (!isMissing(e)) throw e; });
      return;
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
