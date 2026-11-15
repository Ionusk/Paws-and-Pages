import { ArrowLeftRight, BookOpen, UserRound } from 'lucide-react-native';

import { ComingSoonScreen } from '@/components/ui/ComingSoonScreen';
import { PALETTE } from '@/constants/palette';

// Placeholder for a future Campus Books listing. Nothing links here yet.
export default function BookScreen() {
  return (
    <ComingSoonScreen
      eyebrow="CAMPUS BOOKS"
      title="Book details"
      subtitle="Details for books shared by other students."
      heroIcon={BookOpen}
      heroTitle="This page is coming soon"
      heroText="Book listings from Campus Books will open here once the campus library is available."
      heroColor={PALETTE.peach}
      backFallback="/campus"
      backLabel="Back to Campus Books"
      features={[
        {
          icon: UserRound,
          title: 'About the owner',
          description: 'See which student is lending the book.',
        },
        {
          icon: ArrowLeftRight,
          title: 'Request to borrow',
          description: 'Send a loan request in one tap.',
          color: PALETTE.lavender,
          iconColor: PALETTE.purple,
        },
      ]}
    />
  );
}
