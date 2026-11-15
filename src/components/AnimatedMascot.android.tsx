import React from 'react';
import { StyleSheet } from 'react-native';
import { MaskoView } from '@masko/player-react-native';

import type { MascotAnimation } from '@/constants/skins';
import { useSkinVideo } from './SkinProvider';
import { SkinVideo } from './SkinVideo';

type AnimatedMascotProps = {
  animation: MascotAnimation;
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

  return (
    <MaskoView
      style={styles.video}
      clip={clips[animation] as any}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: 300,
    height: 300,
  },
});
