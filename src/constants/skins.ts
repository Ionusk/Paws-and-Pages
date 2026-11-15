// Videos for each shop skin. The ids match `shop_items.id` in TigerData.
// "original" = Laica standing, "sleepy" = Laica sleeping,
// "reading" = Laica reading (reading session). A skin without a reading
// video shows its "original" one instead.

export type MascotAnimation = 'original' | 'sleepy' | 'reading';

type SkinVideoSet = Record<'original' | 'sleepy', number> & { reading?: number };

export const SKIN_VIDEOS: Record<string, SkinVideoSet> = {
  hogwarts: {
    original: require('../../assets/video/hogwarts-in-picioare.webm'),
    sleepy: require('../../assets/video/laica-hogwarts-doarme.webm'),
  },
  graduation: {
    original: require('../../assets/video/laica-toca-in-picioare.webm'),
    sleepy: require('../../assets/video/laica-toca-doarme.webm'),
    reading: require('../../assets/video/laica-citeste.webm'),
  },
};

/** The skin's video for an animation, falling back to standing for "reading". */
export function skinVideoFor(
  skinId: string,
  animation: MascotAnimation
): number | undefined {
  const set = SKIN_VIDEOS[skinId];
  if (!set) return undefined;
  if (animation === 'reading') return set.reading ?? set.original;
  return set[animation];
}
