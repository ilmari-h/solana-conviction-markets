import { WalletGuard } from "@/components/wallet-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WalletGuard>{children}</WalletGuard>;
}
