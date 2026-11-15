import { MaskoView } from '@masko/player-react-native';

import type { MascotAnimation } from '@/constants/skins';
import { useSkinVideo } from './SkinProvider';
import { SkinVideo } from './SkinVideo';

type AnimatedMascotProps = {
  animation: MascotAnimation;
  /** Width and height in points. Defaults to 300. */
  size?: number;
};

// ATENȚIE: forma obiectului clip trebuie confirmată
// cu tipurile exacte ale versiunii instalate.
const clips = {
  original: {
    stacked: require('../../assets/video/laicaoriginal-android.mp4'),
  },
  sleepy: {
    stacked: require('../../assets/video/laicasleepy-android.mp4'),
  },
};

export function AnimatedMascot({ animation, size = 300 }: AnimatedMascotProps) {
  // Equipped shop skin (Hogwarts, Graduation...) replaces the classic look.
  const skinVideo = useSkinVideo(animation);

  if (skinVideo) {
    return (
      <SkinVideo
        key={skinVideo.key}
        source={skinVideo.source}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <MaskoView
      style={{ width: size, height: size }}
      clip={clips[animation] as any}
    />
  );
}
