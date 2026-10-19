import { PolicyView, policyMetadata } from "@/components/PolicyView";

export const generateMetadata = () => policyMetadata("shipping-policy");

export default function ShippingPage() {
  return <PolicyView slug="shipping-policy" />;
}
