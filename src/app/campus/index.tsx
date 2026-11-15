import {
    ArrowLeftRight,
    BookUp,
    History,
    LibraryBig,
    Search,
    ShieldCheck,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth0 } from 'react-native-auth0';

import { ComingSoonScreen } from '@/components/ui/ComingSoonScreen';
import { FONT, PALETTE } from '@/constants/palette';

// Campus Books needs UPT student verification plus listing and loan
// endpoints. None of these exist in the backend yet, so the screen shows the
// access rules and planned features without simulating them.
export default function CampusScreen() {
  const { user } = useAuth0();

  return (
    <ComingSoonScreen
      eyebrow="THE CAMPUS BOOK CORNER"
      title="Books bring us together."
      subtitle="Borrow a book, share one with another student and discover your next read."
      heroIcon={LibraryBig}
      heroTitle="A library made by students"
      heroText="Campus Books isn't open yet. It will let verified UPT students lend and borrow books from each other."
      heroColor={PALETTE.sage}
      features={[
        {
          icon: Search,
          title: 'Browse available books',
          description: 'Discover books offered by other UPT students.',
          color: PALETTE.lavender,
          iconColor: PALETTE.purple,
        },
        {
          icon: BookUp,
          title: 'Share a book',
          description: 'Publish books you are happy to lend.',
        },
        {
          icon: ArrowLeftRight,
          title: 'Request and manage loans',
          description: 'Ask to borrow a book and accept or decline requests.',
          color: PALETTE.peach,
          iconColor: '#A77C6C',
        },
        {
          icon: History,
          title: 'Active and past loans',
          description: 'Keep track of what you borrowed and lent.',
          color: PALETTE.sage,
          iconColor: PALETTE.sageDark,
        },
      ]}
      note={{
        title: 'A safe student community ♡',
        text: 'Personal contact details and meeting arrangements will stay private until a borrowing request is accepted.',
      }}
    >
      <View style={styles.accessCard}>
        <View style={styles.accessIcon}>
          <ShieldCheck size={22} color={PALETTE.sageDark} />
        </View>

        <View style={styles.accessText}>
          <Text style={styles.accessTitle}>Who can join</Text>
          <Text style={styles.accessDescription}>
            Only users with a verified UPT student account will have access.
            Student verification isn’t available yet, so no account can be
            verified at the moment.
          </Text>

          {user?.email ? (
            <Text style={styles.accessStatus}>
              Signed in as {user.email} · not verified
            </Text>
          ) : null}
        </View>
      </View>
    </ComingSoonScreen>
  );
}

const styles = StyleSheet.create({
  accessCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  accessIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: PALETTE.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessText: {
    flex: 1,
  },
  accessTitle: {
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyExtraBold,
  },
  accessDescription: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.body,
    marginTop: 4,
  },
  accessStatus: {
    color: PALETTE.darkPink,
    fontSize: 11,
    fontFamily: FONT.bodyBold,
    marginTop: 8,
  },
});
