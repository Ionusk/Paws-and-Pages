import { MaskoView } from '@masko/player-react-native';

type AnimatedMascotProps = {
  animation: 'original' | 'sleepy';
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
  return (
    <MaskoView
      style={{ width: size, height: size }}
      clip={clips[animation] as any}
    />
  );
}
