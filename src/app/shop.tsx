import { useFocusEffect } from "expo-router";
import {
    ArrowLeft,
    Check,
    Coins,
    Lock,
    Palette,
    RefreshCw,
    ShoppingBag,
    Sparkles,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

import { Notice, StateCard } from "@/components/ui/feedback";
import { getErrorMessage, useApi } from "@/lib/api";
import { confirmAction } from "@/lib/feedback";
import { goBack } from "@/lib/navigation";
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

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type SkinVisual = {
  background: string;
  accent: string;
  decoration: string;
  /** Looping preview video shown on the skin card. */
  video?: number;
};

type Skin = SkinVisual & {
  id: string;
  name: string;
  description: string;
  price: number;
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

type ShopNotice = {
  tone: "success" | "error" | "info";
  message: string;
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
    video: require("../../assets/video/laicaoriginal.webm"),
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

// Used when the backend returns a skin this app version has no artwork for,
// so one new item never breaks the whole shop.
const FALLBACK_VISUAL: SkinVisual = {
  background: "#F5ECFA",
  accent: "#D6B8E5",
  decoration: "#B78DCC",
};

// One key per purchase attempt, so the backend can safely deduplicate retries.
function createIdempotencyKey(itemId: string) {
  return `shop_${itemId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

// --------------------------------------------------
// SHOP SCREEN
// --------------------------------------------------

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 600;

  const { fetchRaw } = useApi();

  const {
    balance,
    loading: walletLoading,
    error: walletError,
    refreshWallet,
  } = usePawWallet();

  const displayedBalance = walletLoading ? "..." : (balance ?? "—");
  const numericBalance =
    !walletLoading && balance !== null ? Number(balance) : null;

  const [skins, setSkins] = useState<ShopSkin[]>([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<ShopNotice | null>(null);

  // ------------------------------------------------
  // LOAD SHOP CATALOG AND INVENTORY
  // ------------------------------------------------

  const loadShop = useCallback(async () => {
    try {
      setShopLoading(true);
      setShopError(null);

      const { ok, data } = await fetchRaw<{
        success?: boolean;
        error?: string;
        items?: ShopApiItem[];
      }>("/api/shop");

      if (!ok || !data.success) {
        throw new Error(data.error || "We couldn't load the shop.");
      }

      if (!Array.isArray(data.items)) {
        throw new Error("The shop returned an unexpected response.");
      }

      const mappedSkins: ShopSkin[] = data.items.map((item) => {
        const visual =
          SKINS.find((skin) => skin.id === item.id) ?? FALLBACK_VISUAL;

        return {
          background: visual.background,
          accent: visual.accent,
          decoration: visual.decoration,
          // Preview video on the card, so skins can be seen before buying.
          video: visual.video,
          id: item.id,
          name: item.name,
          description: item.description ?? "",
          price: Number(item.price),
          owned: Boolean(item.owned),
          equipped: Boolean(item.equipped),
        };
      });

      setSkins(mappedSkins);

      // A skin that now shows as owned is no longer pending.
      setPendingItemIds((ids) =>
        ids.filter((id) => !mappedSkins.some((s) => s.id === id && s.owned)),
      );
    } catch (error) {
      console.error("Shop loading error:", error);

      setShopError(getErrorMessage(error, "We couldn't load the shop."));
    } finally {
      setShopLoading(false);
    }
  }, [fetchRaw]);

  useFocusEffect(
    useCallback(() => {
      loadShop();
    }, [loadShop]),
  );

  // Keeps the skin shown on every other screen in sync with the shop.
  const { refreshSkin } = useSkin();

  const refreshAll = useCallback(async () => {
    await Promise.all([loadShop(), refreshWallet(), refreshSkin()]);
  }, [loadShop, refreshWallet, refreshSkin]);

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
    if (busyItemId !== null || pendingItemIds.includes(skin.id)) return;

    const confirmed = await confirmAction({
      title: `Buy ${skin.name}?`,
      message:
        `This sends ${skin.price} PAW from your wallet to Laica's Shop in a Solana Devnet transaction. ` +
        (numericBalance !== null
          ? `Your balance after the purchase will be ${numericBalance - skin.price} PAW.`
          : "We couldn't check your balance right now; the purchase fails safely if you don't have enough PAW."),
      confirmText: `Buy for ${skin.price} PAW`,
    });

    if (!confirmed) return;

    try {
      setBusyItemId(skin.id);
      setNotice({
        tone: "info",
        message: `Sending your ${skin.price} PAW transaction to Solana. This can take a few seconds...`,
      });

      const idempotencyKey = createIdempotencyKey(skin.id);

      const { ok, status, data } = await fetchRaw<{
        success?: boolean;
        error?: string;
        pendingConfirmation?: boolean;
      }>("/api/shop/purchase", {
        method: "POST",
        body: JSON.stringify({
          itemId: skin.id,
          idempotencyKey,
        }),
      });

      if (status === 202 || data.pendingConfirmation) {
        setPendingItemIds((ids) =>
          ids.includes(skin.id) ? ids : [...ids, skin.id],
        );
        setNotice({
          tone: "info",
          message:
            "Your transaction was sent to Solana and is still being confirmed. Please don't buy this skin again. Check the status in a moment.",
        });
        return;
      }

      if (!ok || !data.success) {
        throw new Error(data.error || "The purchase could not be completed.");
      }

      await refreshAll();

      setNotice({
        tone: "success",
        message: `${skin.name} is now in your collection! Tap "Equip skin" to dress Laica up.`,
      });
    } catch (error) {
      console.error("Shop purchase error:", error);

      setNotice({
        tone: "error",
        message: getErrorMessage(error, "Something went wrong with the purchase."),
      });

      // The balance may have changed on-chain; never keep a stale number.
      refreshWallet();
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
      setNotice(null);

      const { ok, data } = await fetchRaw<{ success?: boolean; error?: string }>(
        "/api/shop/equip",
        {
          method: "POST",
          body: JSON.stringify({
            itemId: skin.id,
          }),
        },
      );

      if (!ok || !data.success) {
        throw new Error(data.error || "We couldn't equip this skin.");
      }

      await Promise.all([loadShop(), refreshSkin()]);

      setNotice({ tone: "success", message: `${skin.name} is now equipped!` });
    } catch (error) {
      console.error("Shop equip error:", error);

      setNotice({
        tone: "error",
        message: getErrorMessage(error, "Something went wrong while equipping."),
      });
    } finally {
      setBusyItemId(null);
    }
  };

  // ------------------------------------------------
  // SKIN CARD
  // ------------------------------------------------

  const renderBuyAction = (skin: ShopSkin) => {
    const isBusy = busyItemId === skin.id;
    const isPending = pendingItemIds.includes(skin.id);

    if (skin.price <= 0) {
      return (
        <View style={[styles.skinAction, styles.skinActionMuted]}>
          <Text style={styles.skinActionText}>Free default look</Text>
        </View>
      );
    }

    if (isPending) {
      return (
        <Pressable
          onPress={refreshAll}
          style={({ pressed }) => [
            styles.skinAction,
            styles.skinActionMuted,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Check the status of your ${skin.name} purchase`}
        >
          <RefreshCw size={14} color={COLORS.text} />
          <Text style={styles.skinActionText}>Confirming... check status</Text>
        </Pressable>
      );
    }

    const missing =
      numericBalance !== null ? Math.max(skin.price - numericBalance, 0) : 0;
    const cannotAfford = missing > 0;
    const disabled = busyItemId !== null || cannotAfford;

    return (
      <Pressable
        onPress={() => handleBuy(skin)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.skinAction,
          styles.buyAction,
          cannotAfford && styles.skinActionMuted,
          pressed && !disabled && styles.pressed,
          (isBusy || (disabled && !cannotAfford)) && styles.actionDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          cannotAfford
            ? `${skin.name} costs ${skin.price} PAW. You need ${missing} more PAW.`
            : `Buy ${skin.name} for ${skin.price} PAW`
        }
        accessibilityState={{ disabled, busy: isBusy }}
      >
        {isBusy ? (
          <>
            <ActivityIndicator size="small" color={COLORS.text} />
            <Text style={styles.buyActionText}>Buying...</Text>
          </>
        ) : cannotAfford ? (
          <>
            <Lock size={14} color={COLORS.muted} />
            <Text style={styles.skinActionMutedText}>
              {skin.price} PAW · need {missing} more
            </Text>
          </>
        ) : (
          <>
            <Coins size={15} color={COLORS.text} />
            <Text style={styles.buyActionText}>Buy for {skin.price} PAW</Text>
          </>
        )}
      </Pressable>
    );
  };

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

          {isEquipped ? (
            <View style={styles.equippedBadge}>
              <Check size={12} color={COLORS.white} />
              <Text style={styles.equippedBadgeText}>EQUIPPED</Text>
            </View>
          ) : isOwned ? (
            <View style={[styles.equippedBadge, styles.ownedBadge]}>
              <Check size={12} color={COLORS.darkPink} />
              <Text style={[styles.equippedBadgeText, styles.ownedBadgeText]}>
                OWNED
              </Text>
            </View>
          ) : skin.price > 0 ? (
            <View style={[styles.equippedBadge, styles.priceBadge]}>
              <Coins size={12} color={COLORS.text} />
              <Text style={[styles.equippedBadgeText, styles.priceBadgeText]}>
                {skin.price} PAW
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.skinInfo}>
          <Text style={styles.skinName} numberOfLines={1}>
            {skin.name}
          </Text>
          <Text style={styles.skinDescription} numberOfLines={2}>
            {skin.description}
          </Text>

          <View style={styles.skinCardFooter}>
            {isOwned ? (
              <Pressable
                onPress={() => handleEquip(skin)}
                disabled={isEquipped || busyItemId !== null}
                style={({ pressed }) => [
                  styles.skinAction,
                  isEquipped && styles.skinActionEquipped,
                  pressed && !isEquipped && styles.pressed,
                  !isEquipped && busyItemId !== null && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isEquipped
                    ? `${skin.name} is equipped`
                    : `Equip ${skin.name}`
                }
                accessibilityState={{
                  disabled: isEquipped || busyItemId !== null,
                  selected: isEquipped,
                  busy: isBusy,
                }}
              >
                {isBusy ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.text} />
                    <Text style={styles.skinActionText}>Equipping...</Text>
                  </>
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
              renderBuyAction(skin)
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
              onPress={() => goBack("/home")}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={19} color={COLORS.text} />
              {isTablet && <Text style={styles.backButtonText}>Back</Text>}
            </Pressable>

            <View style={styles.headerTitle}>
              <Text style={styles.headerTitleText}>Laica’s Shop</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                A little world of possibilities
              </Text>
            </View>

            <View
              style={styles.balancePill}
              accessible
              accessibilityLabel={
                walletError
                  ? "PAW balance unavailable"
                  : `PAW balance: ${displayedBalance}`
              }
            >
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

              <Text
                style={[styles.heroTitle, !isTablet && styles.heroTitleCompact]}
              >
                Make Laica
                {"\n"}
                <Text style={styles.heroTitleAccent}>uniquely yours.</Text>
              </Text>

              <Text style={styles.heroDescription}>
                Give your reading buddy a new look. Buy styles with your PAW
                tokens, then equip the one you love most.
              </Text>

              <View style={styles.heroNote}>
                <Palette size={16} color={COLORS.darkPink} />
                <Text style={styles.heroNoteText}>
                  Purchases are real PAW transfers on Solana Devnet.
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
                <AnimatedMascot animation="original" size={isTablet ? 300 : 240} />
              </View>

              <View style={styles.previewCaption}>
                <View>
                  <Text style={styles.previewSmallText}>
                    CURRENTLY EQUIPPED
                  </Text>
                  <Text style={styles.previewName}>{selectedSkin.name}</Text>
                </View>

                <View style={styles.previewCheck}>
                  <Check size={17} color={COLORS.white} />
                </View>
              </View>
            </View>
          </View>

          {/* WALLET ERROR */}
          {walletError ? (
            <Notice
              tone="error"
              title="We couldn't load your PAW balance"
              message={walletError}
              actionLabel="Try again"
              onAction={refreshWallet}
              style={styles.noticeSpacing}
            />
          ) : null}

          {/* NOTICE */}
          {notice && (
            <Notice
              tone={notice.tone}
              message={notice.message}
              onDismiss={busyItemId ? undefined : () => setNotice(null)}
              actionLabel={pendingItemIds.length > 0 && notice.tone === "info" && !busyItemId ? "Check status" : undefined}
              onAction={refreshAll}
              style={styles.noticeSpacing}
            />
          )}

          {shopLoading && skins.length === 0 ? (
            <StateCard
              loading
              loadingText="Loading Laica's wardrobe..."
              style={styles.section}
            />
          ) : shopError && skins.length === 0 ? (
            <StateCard
              error={shopError}
              onRetry={loadShop}
              style={styles.section}
            />
          ) : (
            <>
              {shopError ? (
                <Notice
                  tone="error"
                  message={shopError}
                  actionLabel="Try again"
                  onAction={loadShop}
                  style={styles.noticeSpacing}
                />
              ) : null}

              {/* COLLECTION */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeading}>
                    <Text style={styles.sectionTitle}>My collection</Text>
                    <Text style={styles.sectionSubtitle}>
                      Skins you own. Equip one to change Laica’s look.
                    </Text>
                  </View>

                  <View style={styles.countPill}>
                    <Text style={styles.countText}>
                      {ownedSkins.length}{" "}
                      {ownedSkins.length === 1 ? "skin" : "skins"}
                    </Text>
                  </View>
                </View>

                {ownedSkins.length > 0 ? (
                  <View style={styles.skinGrid}>
                    {ownedSkins.map((skin) => renderSkinCard(skin, true))}
                  </View>
                ) : (
                  <View style={styles.emptyCollection}>
                    <Palette size={25} color={COLORS.darkPink} />
                    <Text style={styles.emptyTitle}>No skins yet</Text>
                    <Text style={styles.emptyDescription}>
                      Pick a style below to start Laica’s wardrobe.
                    </Text>
                  </View>
                )}
              </View>

              {/* DISCOVER */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeading}>
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

                {discoverSkins.length > 0 ? (
                  <View style={styles.skinGrid}>
                    {discoverSkins.map((skin) => renderSkinCard(skin, false))}
                  </View>
                ) : (
                  <View style={styles.emptyCollection}>
                    <Sparkles size={25} color={COLORS.darkPink} />
                    <Text style={styles.emptyTitle}>
                      You’ve found them all!
                    </Text>
                    <Text style={styles.emptyDescription}>
                      New styles will be waiting for you soon.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* TOKEN INFO */}
          <View style={styles.tokenCard}>
            <View style={styles.tokenIcon}>
              <Coins size={22} color={COLORS.darkPink} />
            </View>

            <View style={styles.tokenInfo}>
              <Text style={styles.tokenTitle}>Your Paw Tokens</Text>
              <Text style={styles.tokenDescription}>
                Your balance is read live from your Solana Devnet wallet.
                Earning PAW from quests is not available yet.
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
    // Room for the account button (top-right corner).
    paddingRight: 58,
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
    minHeight: 44,
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
  heroTitleCompact: {
    fontSize: 30,
    lineHeight: 37,
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
    flexShrink: 1,
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
    width: "100%",
    maxWidth: 300,
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
  noticeSpacing: {
    marginBottom: 25,
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
    gap: 12,
  },
  sectionHeading: {
    flex: 1,
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
  ownedBadge: {
    backgroundColor: COLORS.white,
  },
  ownedBadgeText: {
    color: COLORS.darkPink,
  },
  priceBadge: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  priceBadgeText: {
    color: COLORS.text,
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
    minHeight: 42,
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
  skinActionMuted: {
    backgroundColor: "#F3EEF5",
  },
  skinActionMutedText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
  },
  actionDisabled: {
    opacity: 0.55,
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
    textAlign: "center",
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
