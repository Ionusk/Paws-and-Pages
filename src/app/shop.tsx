import { goBack } from '@/lib/navigation';
import {
  ArrowLeft,
  Check,
  Coins,
  Palette,
  ShoppingBag,
  Sparkles,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth0 } from "react-native-auth0";

import { AnimatedMascot } from "../components/AnimatedMascot";
import { useSkin } from "../components/SkinProvider";
import { SkinVideo, canPlaySkinVideos } from "../components/SkinVideo";
import { SKIN_VIDEOS } from "../constants/skins";
import { usePawWallet } from "../hooks/usePawWallet";

// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const COLORS = {
  background: "#E9DDF2",
  white: "#FFFFFF",
  pink: "#F6C8D4",
  darkPink: "#B77D88",
  text: "#493653",
  muted: "#806B87",
  lavender: "#DCC9EB",
  sage: "#D8E6D8",
  peach: "#F8DFD1",
  border: "#E9DDEA",
};

const API_URL = "http://localhost:3001";
const API_AUDIENCE = "https://paws-and-pages-api";
const AUTH_SCOPE = "openid profile email offline_access";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Skin = {
  id: string;
  name: string;
  description: string;
  price: number;
  background: string;
  accent: string;
  decoration: string;
  /** Looping preview video shown on the card and in the hero preview. */
  video?: number;
};

type ShopSkin = Skin & {
  owned: boolean;
  equipped: boolean;
};

type ShopApiItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  owned: boolean;
  equipped: boolean;
};

// --------------------------------------------------
// SKIN VISUALS
// --------------------------------------------------

const SKINS: Skin[] = [
  {
    id: "classic",
    name: "Classic Laica",
    description: "The original Laica look",
    price: 0,
    background: "#F6EAF4",
    accent: "#D6B8E5",
    decoration: "#B78DCC",
  },
  {
    id: "hogwarts",
    name: "Hogwarts Laica",
    description: "Ready for a magical school year",
    price: 150,
    background: "#F3E3E0",
    accent: "#D9A9A4",
    decoration: "#8E4B5A",
    video: SKIN_VIDEOS.hogwarts.original,
  },
  {
    id: "graduation",
    name: "Graduation Laica",
    description: "Cap on, diploma ready",
    price: 200,
    background: "#E3E6F2",
    accent: "#B3BBDD",
    decoration: "#5E6A9E",
    video: SKIN_VIDEOS.graduation.original,
  },
];

// --------------------------------------------------
// SHOP SCREEN
// --------------------------------------------------

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 600;

  const { getCredentials } = useAuth0();
  const { refreshSkin } = useSkin();

  const { balance, loading: walletLoading, refreshWallet } = usePawWallet();

  const displayedBalance = walletLoading ? "..." : (balance ?? "—");

  const [skins, setSkins] = useState<ShopSkin[]>([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // ------------------------------------------------
  // AUTHENTICATION
  // ------------------------------------------------

  const getAuthHeaders = useCallback(async () => {
    const credentials = await getCredentials(AUTH_SCOPE, 0, {
      audience: API_AUDIENCE,
    });

    if (!credentials.accessToken) {
      throw new Error("Nu am putut obține tokenul Auth0.");
    }

    return {
      Authorization: `Bearer ${credentials.accessToken}`,
    };
  }, [getCredentials]);

  // ------------------------------------------------
  // LOAD SHOP CATALOG AND INVENTORY
  // ------------------------------------------------

  const loadShop = useCallback(async () => {
    try {
      setShopLoading(true);

      const headers = await getAuthHeaders();

      const response = await fetch(`${API_URL}/api/shop`, {
        method: "GET",
        headers,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Nu am putut încărca magazinul.");
      }

      if (!Array.isArray(data.items)) {
        throw new Error("Răspuns invalid primit de la magazin.");
      }

      const apiItems: ShopApiItem[] = data.items;

      const mappedSkins: ShopSkin[] = apiItems.map((item) => {
        const visual = SKINS.find((skin) => skin.id === item.id);

        if (!visual) {
          throw new Error(`Lipsește configurația vizuală pentru ${item.id}.`);
        }

        return {
          ...visual,
          id: item.id,
          name: item.name,
          description: item.description ?? "",
          price: Number(item.price),
          owned: Boolean(item.owned),
          equipped: Boolean(item.equipped),
        };
      });

      setSkins(mappedSkins);
    } catch (error) {
      console.error("Shop loading error:", error);

      setNotice(
        error instanceof Error
          ? error.message
          : "Nu am putut încărca magazinul.",
      );
    } finally {
      setShopLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  // ------------------------------------------------
  // CURRENT SKIN AND COLLECTION
  // ------------------------------------------------

  const selectedSkin = skins.find((skin) => skin.equipped) ?? SKINS[0];

  const ownedSkins = skins.filter((skin) => skin.owned);
  const discoverSkins = skins.filter((skin) => !skin.owned);

  // ------------------------------------------------
  // PURCHASE SKIN WITH PAW
  // ------------------------------------------------

  const handleBuy = async (skin: ShopSkin) => {
    if (busyItemId !== null) return;

    try {
      setBusyItemId(skin.id);
      setNotice("");

      const headers = await getAuthHeaders();

      const idempotencyKey = `shop_${skin.id}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      const response = await fetch(`${API_URL}/api/shop/purchase`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: skin.id,
          idempotencyKey,
        }),
      });

      const data = await response.json();

      if (response.status === 202 || data.pendingConfirmation) {
        setNotice(
          "Tranzacția a fost trimisă către Solana, dar încă se verifică. Nu încerca să cumperi din nou acest skin.",
        );
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Achiziția nu a putut fi efectuată.");
      }

      await Promise.all([loadShop(), refreshWallet(), refreshSkin()]);

      setNotice(`${skin.name} a fost achiziționat cu succes!`);
    } catch (error) {
      console.error("Shop purchase error:", error);

      setNotice(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la achiziție.",
      );
    } finally {
      setBusyItemId(null);
    }
  };

  // ------------------------------------------------
  // EQUIP SKIN
  // ------------------------------------------------

  const handleEquip = async (skin: ShopSkin) => {
    if (busyItemId !== null || skin.equipped) return;

    try {
      setBusyItemId(skin.id);
      setNotice("");

      const headers = await getAuthHeaders();

      const response = await fetch(`${API_URL}/api/shop/equip`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: skin.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Nu am putut echipa acest skin.");
      }

      await Promise.all([loadShop(), refreshSkin()]);

      setNotice(`${skin.name} este acum echipat!`);
    } catch (error) {
      console.error("Shop equip error:", error);

      setNotice(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la echipare.",
      );
    } finally {
      setBusyItemId(null);
    }
  };

  // ------------------------------------------------
  // SKIN CARD
  // ------------------------------------------------

  const renderSkinCard = (skin: ShopSkin, isOwned: boolean) => {
    const isEquipped = skin.equipped;
    const isBusy = busyItemId === skin.id;

    return (
      <View
        key={skin.id}
        style={[
          styles.skinCard,
          {
            width: isWide ? "31.5%" : isTablet ? "48%" : "100%",
            borderColor: isEquipped ? COLORS.darkPink : COLORS.border,
          },
        ]}
      >
        <View
          style={[styles.skinArtwork, { backgroundColor: skin.background }]}
        >
          {skin.video && canPlaySkinVideos ? (
            <SkinVideo source={skin.video} style={styles.skinVideo} />
          ) : (
            <View
              style={[styles.artworkCircle, { backgroundColor: skin.accent }]}
            >
              <View
                style={[
                  styles.artworkInnerCircle,
                  { backgroundColor: skin.decoration },
                ]}
              />

              <Sparkles
                size={23}
                color={COLORS.white}
                strokeWidth={1.8}
                style={styles.artworkSparkle}
              />
            </View>
          )}

          <View style={styles.artworkLabel}>
            <Palette size={13} color={COLORS.text} />
            <Text style={styles.artworkLabelText}>LAICA STYLE</Text>
          </View>

          {isEquipped && (
            <View style={styles.equippedBadge}>
              <Check size={12} color={COLORS.white} />
              <Text style={styles.equippedBadgeText}>EQUIPPED</Text>
            </View>
          )}
        </View>

        <View style={styles.skinInfo}>
          <Text style={styles.skinName}>{skin.name}</Text>
          <Text style={styles.skinDescription}>{skin.description}</Text>

          <View style={styles.skinCardFooter}>
            {isOwned ? (
              <Pressable
                onPress={() => handleEquip(skin)}
                disabled={isEquipped || busyItemId !== null}
                style={({ pressed }) => [
                  styles.skinAction,
                  isEquipped && styles.skinActionEquipped,
                  pressed && !isEquipped && styles.pressed,
                  isBusy && styles.pressed,
                ]}
              >
                {isBusy ? (
                  <Text style={styles.skinActionText}>Please wait...</Text>
                ) : isEquipped ? (
                  <>
                    <Check size={15} color={COLORS.white} />
                    <Text style={styles.skinActionEquippedText}>Equipped</Text>
                  </>
                ) : (
                  <Text style={styles.skinActionText}>Equip skin</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => handleBuy(skin)}
                disabled={busyItemId !== null}
                style={({ pressed }) => [
                  styles.skinAction,
                  styles.buyAction,
                  pressed && styles.pressed,
                  isBusy && styles.pressed,
                ]}
              >
                {isBusy ? (
                  <Text style={styles.buyActionText}>Please wait...</Text>
                ) : (
                  <>
                    <Coins size={15} color={COLORS.text} />
                    <Text style={styles.buyActionText}>{skin.price}</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[styles.container, { paddingHorizontal: isTablet ? 42 : 20 }]}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Pressable
              onPress={() => goBack('/home')}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={19} color={COLORS.text} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.headerTitle}>
              <Text style={styles.headerTitleText}>Laica's Shop</Text>
              <Text style={styles.headerSubtitle}>
                A little world of possibilities
              </Text>
            </View>

            <View style={styles.balancePill}>
              <Coins size={17} color={COLORS.darkPink} />
              <Text style={styles.balanceText}>{displayedBalance}</Text>
              <Text style={styles.balanceLabel}>PAW</Text>
            </View>
          </View>

          {/* HERO */}
          <View
            style={[
              styles.hero,
              {
                flexDirection: isWide ? "row" : "column",
                minHeight: isWide ? 330 : undefined,
              },
            ]}
          >
            <View style={styles.heroText}>
              <View style={styles.eyebrow}>
                <Sparkles size={14} color={COLORS.darkPink} />
                <Text style={styles.eyebrowText}>YOUR READING COMPANION</Text>
              </View>

              <Text style={styles.heroTitle}>
                Make Laica
                {"\n"}
                <Text style={styles.heroTitleAccent}>uniquely yours.</Text>
              </Text>

              <Text style={styles.heroDescription}>
                Give your reading buddy a new look. Discover styles, collect
                your favourites and make every reading session a little more
                special.
              </Text>

              <View style={styles.heroNote}>
                <Palette size={16} color={COLORS.darkPink} />
                <Text style={styles.heroNoteText}>
                  Your style, your little companion.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.previewContainer,
                { backgroundColor: selectedSkin.background },
              ]}
            >
              <View
                style={[
                  styles.previewDecoration,
                  { backgroundColor: selectedSkin.accent },
                ]}
              />

              <View style={styles.previewMascot}>
                {/* Shows the equipped skin (same as on every other screen). */}
                <AnimatedMascot animation="original" />
              </View>

              <View style={styles.previewCaption}>
                <View>
                  <Text style={styles.previewSmallText}>
                    CURRENTLY SELECTED
                  </Text>
                  <Text style={styles.previewName}>{selectedSkin.name}</Text>
                </View>

                <View style={styles.previewCheck}>
                  <Check size={17} color={COLORS.white} />
                </View>
              </View>
            </View>
          </View>

          {/* NOTICE */}
          {notice !== "" && (
            <View style={styles.notice}>
              <Sparkles size={16} color={COLORS.darkPink} />
              <Text style={styles.noticeText}>{notice}</Text>

              <Pressable onPress={() => setNotice("")}>
                <Text style={styles.noticeDismiss}>Dismiss</Text>
              </Pressable>
            </View>
          )}

          {/* COLLECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>My collection</Text>
                <Text style={styles.sectionSubtitle}>
                  The styles you've collected so far
                </Text>
              </View>

              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {ownedSkins.length}{" "}
                  {ownedSkins.length === 1 ? "skin" : "skins"}
                </Text>
              </View>
            </View>

            {shopLoading ? (
              <Text style={styles.sectionSubtitle}>
                Loading your collection...
              </Text>
            ) : (
              <View style={styles.skinGrid}>
                {ownedSkins.map((skin) => renderSkinCard(skin, true))}
              </View>
            )}
          </View>

          {/* DISCOVER */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Discover</Text>
                <Text style={styles.sectionSubtitle}>
                  Find something new for Laica
                </Text>
              </View>

              <View style={styles.discoverPill}>
                <ShoppingBag size={14} color={COLORS.darkPink} />
                <Text style={styles.discoverPillText}>THE SHOP</Text>
              </View>
            </View>

            {shopLoading ? (
              <Text style={styles.sectionSubtitle}>
                Loading available skins...
              </Text>
            ) : discoverSkins.length > 0 ? (
              <View style={styles.skinGrid}>
                {discoverSkins.map((skin) => renderSkinCard(skin, false))}
              </View>
            ) : (
              <View style={styles.emptyCollection}>
                <Sparkles size={25} color={COLORS.darkPink} />
                <Text style={styles.emptyTitle}>You've found them all!</Text>
                <Text style={styles.emptyDescription}>
                  New styles will be waiting for you soon.
                </Text>
              </View>
            )}
          </View>

          {/* TOKEN INFO */}
          <View style={styles.tokenCard}>
            <View style={styles.tokenIcon}>
              <Coins size={22} color={COLORS.darkPink} />
            </View>

            <View style={styles.tokenInfo}>
              <Text style={styles.tokenTitle}>Your Paw Tokens</Text>
              <Text style={styles.tokenDescription}>
                Keep reading, completing quests and earning rewards to unlock
                more styles.
              </Text>
            </View>

            <View style={styles.tokenBalance}>
              <Text style={styles.tokenBalanceNumber}>{displayedBalance}</Text>
              <Text style={styles.tokenBalanceLabel}>PAW</Text>
            </View>
          </View>

          <Text style={styles.footer}>
            Made with love for readers and their little companions.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 50,
  },
  container: {
    width: "100%",
    maxWidth: 1250,
    alignSelf: "center",
    paddingTop: 28,
  },

  // HEADER
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Nunito_800ExtraBold",
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  headerTitleText: {
    color: COLORS.text,
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: "Nunito_600SemiBold",
    marginTop: 2,
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
  },
  balanceLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
  },

  // HERO
  hero: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    padding: 25,
    marginBottom: 30,
    overflow: "hidden",
    gap: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroText: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 15,
  },
  eyebrowText: {
    color: COLORS.darkPink,
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: "Nunito_800ExtraBold",
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 39,
    lineHeight: 47,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  heroTitleAccent: {
    color: COLORS.darkPink,
  },
  heroDescription: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 23,
    fontFamily: "Nunito_400Regular",
    marginTop: 15,
    maxWidth: 450,
  },
  heroNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },
  heroNoteText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  previewContainer: {
    flex: 1,
    minHeight: 300,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  previewDecoration: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.28,
    top: 10,
  },
  previewMascot: {
    width: 300,
    height: 255,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewCaption: {
    position: "absolute",
    bottom: 13,
    left: 13,
    right: 13,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewSmallText: {
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: "Nunito_800ExtraBold",
  },
  previewName: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: "Nunito_800ExtraBold",
    marginTop: 2,
  },
  previewCheck: {
    backgroundColor: COLORS.darkPink,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  // NOTICE
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF4F5",
    borderWidth: 1,
    borderColor: COLORS.pink,
    borderRadius: 15,
    padding: 14,
    marginBottom: 25,
  },
  noticeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  noticeDismiss: {
    color: COLORS.darkPink,
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
  },

  // SECTIONS
  section: {
    marginBottom: 34,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: "Nunito_400Regular",
    marginTop: 3,
  },
  countPill: {
    backgroundColor: "#F9EEF6",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
  },
  countText: {
    color: COLORS.darkPink,
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
  },
  discoverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF0F2",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
  },
  discoverPillText: {
    color: COLORS.darkPink,
    fontSize: 10,
    letterSpacing: 0.7,
    fontFamily: "Nunito_800ExtraBold",
  },
  skinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },

  // SKIN CARDS
  skinCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 11,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  skinArtwork: {
    height: 165,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  skinVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  artworkCircle: {
    width: 105,
    height: 105,
    borderRadius: 53,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    opacity: 0.8,
  },
  artworkSparkle: {
    position: "absolute",
    top: 13,
    right: 9,
  },
  artworkLabel: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  artworkLabelText: {
    color: COLORS.text,
    fontSize: 8,
    letterSpacing: 0.8,
    fontFamily: "Nunito_800ExtraBold",
  },
  equippedBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.darkPink,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  equippedBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    letterSpacing: 0.5,
    fontFamily: "Nunito_800ExtraBold",
  },
  skinInfo: {
    paddingHorizontal: 5,
    paddingTop: 13,
    paddingBottom: 4,
  },
  skinName: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: "Nunito_800ExtraBold",
  },
  skinDescription: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
    marginTop: 3,
  },
  skinCardFooter: {
    marginTop: 15,
  },
  skinAction: {
    minHeight: 39,
    borderRadius: 12,
    backgroundColor: "#F9EEF6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
  },
  skinActionText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
  },
  skinActionEquipped: {
    backgroundColor: COLORS.darkPink,
  },
  skinActionEquippedText: {
    color: COLORS.white,
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
  },
  buyAction: {
    backgroundColor: COLORS.pink,
  },
  buyActionText: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Nunito_800ExtraBold",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  // EMPTY STATE
  emptyCollection: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: "Nunito_800ExtraBold",
    marginTop: 12,
  },
  emptyDescription: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: "Nunito_400Regular",
    marginTop: 5,
  },

  // TOKEN CARD
  tokenCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tokenIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFF0F2",
    alignItems: "center",
    justifyContent: "center",
  },
  tokenInfo: {
    flex: 1,
  },
  tokenTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
  },
  tokenDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: "Nunito_400Regular",
    marginTop: 3,
  },
  tokenBalance: {
    alignItems: "flex-end",
  },
  tokenBalanceNumber: {
    color: COLORS.darkPink,
    fontSize: 23,
    fontFamily: "Nunito_800ExtraBold",
  },
  tokenBalanceLabel: {
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: "Nunito_800ExtraBold",
  },
  footer: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
    marginTop: 30,
  },
});
