import { router, useLocalSearchParams } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAddFriend } from '@/api/queries';
import { fonts, useColors } from '@/theme';
import { Button } from '@/ui/primitives';

/** Opened by an invite link (cap://invite/<code>): adds the inviter as a friend. */
export default function InviteScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { code } = useLocalSearchParams<{ code: string }>();
  const add = useAddFriend();
  const [name, setName] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { mutate } = add;

  useEffect(() => {
    if (!code) return;
    mutate(
      { invite_code: code },
      { onSuccess: (result) => setName(result.friend.first_name), onError: () => setFailed(true) },
    );
  }, [code, mutate]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {name ? (
        <>
          <UserCheck size={44} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>
            {t('friends.joined', { name })}
          </Text>
        </>
      ) : failed ? (
        <Text style={[styles.title, { color: colors.text }]}>{t('friends.badInvite')}</Text>
      ) : (
        <ActivityIndicator size="large" />
      )}
      {(name || failed) && (
        <Button
          title={t('friends.seeFriends')}
          onPress={() => router.replace('/friends')}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 },
  title: { fontFamily: fonts.display, fontSize: 24, textAlign: 'center', lineHeight: 30 },
  button: { alignSelf: 'stretch' },
});
