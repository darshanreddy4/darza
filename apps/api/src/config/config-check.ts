// Refuses to boot in production with development defaults or missing settings.
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return;
  const problems: string[] = [];

  const secret = env.JWT_SECRET ?? "";
  if (secret.length < 32 || /change-me|secret|password/i.test(secret)) problems.push("JWT_SECRET must be a random string of 32+ characters");

  const origins = (env.WEB_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((o) => !o.startsWith("https://"))) problems.push("WEB_ORIGIN must list https:// origins");

  if (!env.MAIL_FROM || !(env.AWS_REGION || env.SMTP_URL)) problems.push("MAIL_FROM and either SMTP_URL or AWS_REGION must be set so verification and password reset emails are delivered");

  if (env.STORAGE_DRIVER === "s3" && (!env.S3_BUCKET || !(env.S3_REGION || env.S3_ENDPOINT))) problems.push("STORAGE_DRIVER=s3 needs S3_BUCKET and S3_REGION (or S3_ENDPOINT)");
  if (env.STORAGE_DRIVER && !["local", "s3"].includes(env.STORAGE_DRIVER)) problems.push("STORAGE_DRIVER must be local or s3");

  if (env.MEILI_URL && (!env.MEILI_MASTER_KEY || env.MEILI_MASTER_KEY.length < 24 || /dmg-dev/i.test(env.MEILI_MASTER_KEY))) {
    problems.push("MEILI_MASTER_KEY must be a random key of 24+ characters (not the development key)");
  }

  if (env.OTP_DEBUG_RESPONSE) problems.push("OTP_DEBUG_RESPONSE is for automated tests only and must not be set in production");
  if (env.DISABLE_RATE_LIMIT) problems.push("DISABLE_RATE_LIMIT is for automated tests only and must not be set in production");

  if (problems.length) throw new Error(`Unsafe production configuration:\n - ${problems.join("\n - ")}`);
}

// Used by the seed script, which creates the first admin account.
export function assertAdminPassword(password: string, env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production" && (password.length < 12 || /change-me/i.test(password))) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters and not the example value when NODE_ENV=production");
  }
}
