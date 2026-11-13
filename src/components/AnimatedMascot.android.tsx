
import React from 'react';
import { StyleSheet } from 'react-native';
import { MaskoView } from '@masko/player-react-native';

type AnimatedMascotProps = {
  animation: 'original' | 'sleepy';
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