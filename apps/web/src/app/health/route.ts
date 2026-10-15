export const dynamic = "force-dynamic";

// For load balancers and uptime monitors.
export function GET() {
  return Response.json({ status: "ok" });
}
