import { VerifyEmail } from "@/components/VerifyEmail";

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  return <VerifyEmail token={Array.isArray(token) ? token[0] : token} />;
}
