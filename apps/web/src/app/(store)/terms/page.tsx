import { PolicyView, policyMetadata } from "@/components/PolicyView";

export const generateMetadata = () => policyMetadata("terms");

export default function TermsPage() {
  return <PolicyView slug="terms" />;
}
