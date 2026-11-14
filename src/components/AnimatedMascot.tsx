type AnimatedMascotProps = {
  animation: "original" | "sleepy";
};

export function AnimatedMascot({ animation }: AnimatedMascotProps) {
  void animation;
  return null;
}
