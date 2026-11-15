import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';

type AnimatedMascotProps = {
  animation: 'original' | 'sleepy';
  /** Width and height in points. Defaults to 300. */
  size?: number;
};

const videos = {
  original: require('../../assets/video/laicaoriginal.webm'),
  sleepy: require('../../assets/video/laicasleepy.webm'),
};

export function AnimatedMascot({ animation, size = 300 }: AnimatedMascotProps) {
  const player = useVideoPlayer(videos[animation], (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    player.play();

    return () => {
      player.pause();
    };
  }, [player, animation]);

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
