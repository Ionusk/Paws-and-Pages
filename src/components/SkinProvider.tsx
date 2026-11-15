import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth0 } from 'react-native-auth0';

import { skinVideoFor, type MascotAnimation } from '@/constants/skins';
import { canPlaySkinVideos } from '@/components/SkinVideo';
import { API_AUDIENCE, API_URL } from '@/lib/voiceConversations';

const AUTH_SCOPE = 'openid profile email offline_access';

type SkinContextValue = {
  /** Id of the skin equipped in TigerData, or null for Classic Laica. */
  equippedSkinId: string | null;
  /** Reload the equipped skin, e.g. after buying or equipping one. */
  refreshSkin: () => Promise<void>;
};

const SkinContext = createContext<SkinContextValue>({
  equippedSkinId: null,
  refreshSkin: async () => {},
});

export function SkinProvider({ children }: React.PropsWithChildren) {
  const { user, getCredentials } = useAuth0();
  const [equippedSkinId, setEquippedSkinId] = useState<string | null>(null);

  const refreshSkin = useCallback(async () => {
    try {
      const credentials = await getCredentials(AUTH_SCOPE, 0, {
        audience: API_AUDIENCE,
      });

      if (!credentials?.accessToken) return;

      const response = await fetch(`${API_URL}/api/shop`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !Array.isArray(data.items)) return;

      const equipped = data.items.find(
        (item: { equipped?: boolean }) => item.equipped
      );

      setEquippedSkinId(equipped?.id ?? null);
    } catch (error) {
      // Not fatal: Laica just keeps her classic look.
      console.warn('Could not load equipped skin:', error);
    }
  }, [getCredentials]);

  useEffect(() => {
    if (user) {
      refreshSkin();
    }
  }, [user, refreshSkin]);

  return (
    <SkinContext.Provider
      value={{
        // Logged out (welcome and login screens): always the classic Laica.
        equippedSkinId: user ? equippedSkinId : null,
        refreshSkin,
      }}
    >
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  return useContext(SkinContext);
}

/**
 * The video of the equipped skin for this animation, or null when Laica
 * should use her classic look (no skin, Classic skin, or iOS, which cannot
 * play the .webm skin videos).
 */
export function useSkinVideo(animation: MascotAnimation) {
  const { equippedSkinId } = useSkin();

  if (!equippedSkinId || !canPlaySkinVideos) return null;

  const source = skinVideoFor(equippedSkinId, animation);

  return source ? { key: `${equippedSkinId}-${animation}`, source } : null;
}
