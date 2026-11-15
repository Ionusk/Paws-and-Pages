import { useVideoPlayer, VideoView } from 'expo-video';

import type { MascotAnimation } from '@/constants/skins';

type AnimatedMascotProps = {
  animation: MascotAnimation;
  /** Width and height in points. Defaults to 300. */
  size?: number;
};

const videos = {
  original: require('../../assets/video/laicaoriginal-ios.mov'),
  sleepy: require('../../assets/video/laicasleepy-ios.mov'),
  reading: require('../../assets/video/laicaoriginal-ios.mov'),
};

export function AnimatedMascot({ animation, size = 300 }: AnimatedMascotProps) {
  const player = useVideoPlayer(videos[animation], (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      nativeControls={false}
      contentFit="contain"
      accessible
      accessibilityLabel="Laica, the Paws & Pages mascot"
    />
  );
}
