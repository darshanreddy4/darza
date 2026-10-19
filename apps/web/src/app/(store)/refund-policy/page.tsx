import { PolicyView, policyMetadata } from "@/components/PolicyView";

export const generateMetadata = () => policyMetadata("refund-policy");

export default function RefundPage() {
  return <PolicyView slug="refund-policy" />;
}
