import { AccountView } from "@/components/AccountView";

export const metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <AccountView />;
}
