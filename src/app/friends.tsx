import { MessageCircleHeart, Sparkles, UserPlus, UsersRound } from 'lucide-react-native';

import { ComingSoonScreen } from '@/components/ui/ComingSoonScreen';
import { PALETTE } from '@/constants/palette';

// The backend has no friends, activity feed or shared reviews endpoints yet,
// so this screen describes what's planned instead of offering buttons that
// would do nothing.
export default function FriendsScreen() {
  return (
    <ComingSoonScreen
      eyebrow="YOUR LITTLE COMMUNITY"
      title="Friends & pages"
      subtitle="Share your reading adventures and celebrate each other's progress."
      heroIcon={UsersRound}
      heroTitle="Better together, soon!"
      heroText="Friends aren't available yet. When they arrive, your friends' reading updates and study achievements will appear here."
      heroColor={PALETTE.sage}
      features={[
        {
          icon: UserPlus,
          title: 'Find friends',
          description: 'Connect with other readers and students.',
          color: PALETTE.lavender,
          iconColor: PALETTE.purple,
        },
        {
          icon: Sparkles,
          title: 'Friends activity',
          description: 'See what your friends are reading and learning.',
          color: PALETTE.lightPink,
        },
        {
          icon: MessageCircleHeart,
          title: 'Shared reviews',
          description: 'Discover what everyone thinks about their books.',
          color: PALETTE.peach,
          iconColor: '#A77C6C',
        },
      ]}
    />
  );
}
