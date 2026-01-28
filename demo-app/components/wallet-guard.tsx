"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface WalletGuardProps {
  children: React.ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const { connected, connecting } = useWallet();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Wait for wallet adapter to initialize after hydration
  useEffect(() => {
    // Give autoConnect time to kick in
    const timeout = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

  // Redirect only after we're ready and confirmed not connected
  useEffect(() => {
    if (isReady && !connecting && !connected) {
      router.push("/");
    }
  }, [isReady, connecting, connected, router]);

  // Still initializing
  if (!isReady || connecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  // Not connected - redirect in progress
  if (!connected) {
    return null;
  }

  return <>{children}</>;
}
