import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "react-native-auth0";

const API_URL = "http://localhost:3001";
const API_AUDIENCE = "https://paws-and-pages-api";
const AUTH_SCOPE = "openid profile email offline_access";

type PawWallet = {
  address: string;
  pawBalance: string;
};

export function usePawWallet() {
  const { getCredentials } = useAuth0();

  const [wallet, setWallet] = useState<PawWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const credentials = await getCredentials(AUTH_SCOPE, 0, {
        audience: API_AUDIENCE,
      });

      if (!credentials.accessToken) {
        throw new Error("Nu am putut obține tokenul Auth0.");
      }

      const response = await fetch(`${API_URL}/api/wallet`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Nu am putut obține soldul PAW.");
      }

      setWallet({
        address: data.wallet.address,
        pawBalance: String(data.wallet.pawBalance),
      });
    } catch (err) {
      console.error("Wallet error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "A apărut o eroare la citirea wallet-ului.",
      );
    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  return {
    wallet,
    balance: wallet?.pawBalance ?? null,
    loading,
    error,
    refreshWallet,
  };
}
