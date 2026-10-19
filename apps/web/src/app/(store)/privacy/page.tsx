import { PolicyView, policyMetadata } from "@/components/PolicyView";

export const generateMetadata = () => policyMetadata("privacy");

export default function PrivacyPage() {
  return <PolicyView slug="privacy" />;
}
