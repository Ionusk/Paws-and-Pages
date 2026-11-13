
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
    hevc: require('../../assets/video/laicaoriginal-ios.mov'),
  },
  sleepy: {
    hevc: require('../../assets/video/laicasleepy-ios.mov'),
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
