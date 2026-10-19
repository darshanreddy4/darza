import { PolicyView, policyMetadata } from "@/components/PolicyView";

export const generateMetadata = () => policyMetadata("affiliate-disclosure");

export default function AffiliateDisclosurePage() {
  return <PolicyView slug="affiliate-disclosure" />;
}
