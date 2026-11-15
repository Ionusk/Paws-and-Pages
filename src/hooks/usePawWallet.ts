import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { ApiError, getErrorMessage, useApi } from "@/lib/api";

type PawWallet = {
  address: string;
  pawBalance: string;
};

/**
 * Reads the user's wallet and on-chain PAW balance from the backend.
 * The balance always comes from Solana via the API; it is never computed
 * on the client.
 */
export function usePawWallet() {
  const { request } = useApi();

  const [wallet, setWallet] = useState<PawWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await request<{
        wallet: { address: string; pawBalance: string | number };
      }>("/api/wallet");

      if (!data?.wallet?.address) {
        throw new Error("The server did not return a wallet.");
      }

      setWallet({
        address: data.wallet.address,
        pawBalance: String(data.wallet.pawBalance),
      });
    } catch (err) {
      // The server runs without Solana keys: not an error, just no wallet.
      if (err instanceof ApiError && err.data?.code === "solana_not_configured") {
        setWallet(null);
        setError(err.message);
        return;
      }

      console.error("Wallet error:", err);

      // Never keep showing an old balance as if it were current.
      setWallet(null);
      setError(getErrorMessage(err, "We couldn't load your PAW balance."));
    } finally {
      setLoading(false);
    }
  }, [request]);

  // Reload whenever the screen gains focus, so a balance changed by a
  // purchase on another screen is never shown out of date.
  useFocusEffect(
    useCallback(() => {
      refreshWallet();
    }, [refreshWallet])
  );

  return {
    wallet,
    balance: wallet?.pawBalance ?? null,
    loading,
    error,
    refreshWallet,
  };
}
