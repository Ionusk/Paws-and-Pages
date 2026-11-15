import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import type { MascotAnimation } from '@/constants/skins';
import { useSkinVideo } from './SkinProvider';
import { SkinVideo } from './SkinVideo';

type AnimatedMascotProps = {
  animation: MascotAnimation;
};

const videos = {
  original: require('../../assets/video/laicaoriginal.webm'),
  sleepy: require('../../assets/video/laicasleepy.webm'),
};

export function AnimatedMascot({ animation }: AnimatedMascotProps) {
  // Equipped shop skin (Hogwarts, Graduation...) replaces the classic look.
  const skinVideo = useSkinVideo(animation);

  if (skinVideo) {
    return (
      <SkinVideo
        key={skinVideo.key}
        source={skinVideo.source}
        style={styles.video}
      />
    );
  }

  return <ClassicMascot animation={animation} />;
}

function ClassicMascot({ animation }: AnimatedMascotProps) {
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
      style={styles.video}
      nativeControls={false}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: 300,
    height: 300,
    backgroundColor: 'transparent',
  },
});
