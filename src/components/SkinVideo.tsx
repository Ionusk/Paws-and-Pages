import React, { useEffect } from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';

type SkinVideoProps = {
  source: VideoSource;
  style?: StyleProp<ViewStyle>;
};

// iOS cannot play .webm files, and the skin videos only exist as .webm.
export const canPlaySkinVideos = Platform.OS !== 'ios';

/** Muted, looping skin preview video (no controls). */
export function SkinVideo({ source, style }: SkinVideoProps) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls={false}
      contentFit="contain"
    />
  );
}
