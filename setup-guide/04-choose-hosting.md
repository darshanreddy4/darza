# 4. Choose where to host

You can postpone this decision. The code does not depend on any host: it ships as two standard Docker images (API and web), talks to a standard PostgreSQL database, and keeps files either on a disk or in any S3-compatible bucket. Moving later means copying the database and the files and changing two DNS records.

## Three ways to run it

| | **A. One server (Docker Compose)** | **B. Managed platforms** | **C. Kubernetes / enterprise** |
|---|---|---|---|
| Idea | One rented machine runs everything | Web, API, database, storage are separate rented services | Your own cluster |
| Best for | Starting out, predictable cost, full control | Teams that do not want to manage servers, automatic scaling | Companies with a platform team |
| Effort | Low (one command) | Medium (several consoles) | High |
| Typical monthly cost | Lowest | Medium | Highest |
| Scaling | Move to a bigger machine | Add instances | Add pods |
| Uploads | Disk volume or bucket | **Bucket required** when more than one API instance runs | Bucket required |
| Guide | [05](05-deploy-one-server.md) | [06](06-deploy-managed-platforms.md) | Use the same images; see section below |

**Recommendation:** start with A. It is fully scripted and tested. When traffic grows, move the database to a managed one and the uploads to a bucket (a settings change, no code change), then add more API containers.

## Where each piece can live

| Piece | Self-run (inside Docker) | Managed alternatives |
|---|---|---|
| Web app | Docker image `apps/web` | Vercel, Netlify, Cloudflare Pages/Workers (Next.js), AWS Amplify, Google Cloud Run, Azure Container Apps, Render, Railway, Fly.io |
| API | Docker image `apps/api` | Render, Railway, Fly.io, Google Cloud Run, AWS ECS/Fargate or App Runner, Azure Container Apps, DigitalOcean App Platform |
| PostgreSQL | Container in `deploy/docker-compose.yml` | Amazon RDS, Google Cloud SQL, Azure Database, DigitalOcean Managed DB, Supabase, Neon, Aiven, Render Postgres |
| Redis | Container | Upstash, Redis Cloud, ElastiCache, Memorystore |
| Files | Docker volume | Cloudflare R2, Amazon S3, DigitalOcean Spaces, Backblaze B2, Wasabi, Google Cloud Storage (S3 interoperability mode), Azure (through MinIO gateway), MinIO |
| Email | n/a | Any SMTP provider, Amazon SES |
| Search | Container (profile `search`) | Meilisearch Cloud |

Mixing is fine. For example: web on Vercel, API on a VPS, database on Neon, files on Cloudflare R2.

## Rules that hold on every host

1. **Web and API share a parent domain** (`www.` and `api.` of the same domain) because the login is a secure cookie.
2. **The API must be reachable by the browser** at `NEXT_PUBLIC_API_URL`, over https, with CORS allowed for the shop address (`WEB_ORIGIN`). Nothing else is needed.
3. **The API needs a way to run database migrations on each release.** The Docker image does this automatically when it starts (`RUN_MIGRATIONS=true`, the default). If you prefer to run them as a release step, set `RUN_MIGRATIONS=false` and run `npx prisma migrate deploy`.
4. **More than one API instance means uploads must be in a bucket** (`STORAGE_DRIVER=s3`), otherwise each instance sees only its own files.
5. **Razorpay's webhook must reach the API:** `https://<api address>/payments/razorpay/webhook`.
6. **Health checks:** point your load balancer or uptime monitor at `GET /health` (is it alive) and `GET /health/ready` (database and storage reachable) on the API, and `GET /health` on the web app.
7. **Keep backups outside the machine that holds the data.**

## Moving from one host to another later

1. Put the new server in place (guide 05 or 06) with the same `JWT_SECRET` if you want customers to stay signed in.
2. Take a database backup on the old host (`deploy/backup.sh`, or `pg_dump -Fc`) and restore it on the new one.
3. Copy files: with `STORAGE_DRIVER=s3`, nothing to move (same bucket). With local disks, copy the uploads folder. To change from disk to a bucket, upload the contents of the folder into the bucket with the same file names, then set `STORAGE_DRIVER=s3`. Links stored in the database stay valid because they only contain file names.
4. Lower your DNS time-to-live a day ahead, switch the two DNS records, and check `/health/ready`.

## Kubernetes and other container platforms

Use the two images as they are:

- API image: port 4000, environment variables from [configuration](03-configuration.md), health probes `/health` (liveness) and `/health/ready` (readiness), runs migrations on start (or set `RUN_MIGRATIONS=false` and run `prisma migrate deploy` in a job).
- Web image: port 3000, health probe `/health`, build with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` build arguments.
- Use `TRUST_PROXY` equal to the number of proxies in front of the API, `STORAGE_DRIVER=s3`, and a managed PostgreSQL.
- The API handles `SIGTERM` gracefully, so rolling updates finish in-flight requests.
