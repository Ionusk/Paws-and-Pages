// Videos for each shop skin. The ids match `shop_items.id` in TigerData.
// "original" = Laica standing, "sleepy" = Laica sleeping.

export type MascotAnimation = 'original' | 'sleepy';

export const SKIN_VIDEOS: Record<string, Record<MascotAnimation, number>> = {
  hogwarts: {
    original: require('../../assets/video/hogwarts-in-picioare.webm'),
    sleepy: require('../../assets/video/laica-hogwarts-doarme.webm'),
  },
  graduation: {
    original: require('../../assets/video/laica-toca-in-picioare.webm'),
    sleepy: require('../../assets/video/laica-toca-doarme.webm'),
  },
};
