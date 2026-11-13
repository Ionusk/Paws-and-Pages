
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type AnimatedMascotProps = {
  animation: 'original' | 'sleepy';
};

const videos = {
  original: require('../../assets/video/laicaoriginal.webm'),
  sleepy: require('../../assets/video/laicasleepy.webm'),
};

export function AnimatedMascot({ animation }: AnimatedMascotProps) {
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
