import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { formatPostDistance } from '../../map/postProximity';
import type { getPostProximity } from '../../map/postProximity';
import { RADIUS_METERS } from '../../map/filterNearbyPosts';
import { uiColors } from '../../shared/uiColors';

type Props = { onClose: () => void } & (
  | {
      postId: number;
      token: string;
      onHidden?: () => void;
      onDeleted?: () => void;
      onVisibilityChanged?: () => void;
    }
  | { distanceMeters: number | null }
);

// 旧一覧モーダル用の詳細表示。ホームの圏外案内は下のPostDistanceNoticeを使う。
export function PostDetailModal(props: Props) {
  const { onClose } = props;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {'distanceMeters' in props ? (
        <SafeAreaView style={styles.screen}>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>投稿詳細</Text>
            <DistanceCard distanceMeters={props.distanceMeters} />
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.back}>
              <Text style={styles.backText}>戻る</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
        <PostDetailScreen token={props.token} route={{ params: { postId: props.postId } }}
          navigation={{ goBack: onClose }} onHidden={props.onHidden ?? onClose}
          onDeleted={props.onDeleted} onVisibilityChanged={props.onVisibilityChanged} />
      )}
    </Modal>
  );
}

// 旧詳細モーダルで現在地から投稿までの距離を表示する。
function DistanceCard({ distanceMeters }: { distanceMeters: number | null }) {
  return <View style={styles.card}>
    <Text style={styles.label}>{distanceMeters === null ? '距離を表示できません' : '範囲外の投稿'}</Text>
    <Text style={styles.distance}>{distanceMeters === null
      ? '現在地の取得後に距離を確認できます。'
      : `現在地から約 ${(distanceMeters / 1000).toFixed(2)} km`}</Text>
    {distanceMeters !== null && <Text>この場所に近づくと閲覧できます。</Text>}
  </View>;
}

// 選択中の投稿について、圏外では距離と方角、圏内では「声を読む」を表示する。
export function PostDistanceNotice({ proximity, arrived, onRead }: {
  proximity: ReturnType<typeof getPostProximity>;
  arrived: boolean;
  onRead: () => void;
}) {
  const [showArrival, setShowArrival] = useState(arrived);
  const [opacity] = useState(() => new Animated.Value(1));
  const lastOutside = useRef(proximity);
  useLayoutEffect(() => {
    if (proximity && !proximity.withinRadius) lastOutside.current = proximity;
  }, [proximity]);

  useEffect(() => {
    const switching = showArrival !== arrived;
    const animation = Animated.timing(opacity, {
      toValue: switching ? 0 : 1, duration: 250, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && switching) setShowArrival(arrived);
    });
    return () => animation.stop();
  }, [arrived, showArrival, opacity]);

  const visibleProximity = arrived && !showArrival ? lastOutside.current : proximity;
  const outside = visibleProximity !== null && !visibleProximity.withinRadius;
  const distance = outside ? formatPostDistance(visibleProximity.distance) : null;
  const remaining = outside ? formatPostDistance(visibleProximity.remaining, true) : null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View style={[styles.card, { opacity }]}>
        {showArrival ? (
          <View style={styles.arrival}>
            <Svg accessible={false} width={28} height={28} viewBox="0 0 24 24" fill="none"
              stroke={uiColors.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 16a3 3 0 0 1-3 3h-6l-5 3v-3a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" />
            </Svg>
            <Text accessibilityRole="header" style={styles.arrivalTitle}>声が読めるようになりました</Text>
            <Pressable accessibilityRole="button" disabled={!arrived} style={styles.readButton} onPress={onRead}>
              <Text style={styles.backText}>声を読む</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.label}>{outside ? '範囲外の声' : '投稿場所'}</Text>
            {outside && distance && remaining ? (
              <>
                <View accessible accessibilityLabel={`${visibleProximity.direction}に${distance.value}${distance.unit}`}
                  style={styles.distanceRow}>
                  <Svg accessible={false} width={20} height={20} viewBox="0 0 24 24"
                    style={{ transform: [{ rotate: `${visibleProximity.arrowRotation}deg` }] }}
                    fill="none" stroke={uiColors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 20V4m-6 6 6-6 6 6" />
                  </Svg>
                  <Text style={styles.direction}>{visibleProximity.direction}に</Text>
                  <Text style={styles.direction}>
                    <Text style={styles.distanceNumber}>{distance.value}</Text>{` ${distance.unit}`}
                  </Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.explanation}>この場所の{RADIUS_METERS}m以内に入ると読めます。</Text>
                <Text style={styles.remaining}>閲覧できるまで、あと{remaining.value}{remaining.unit}</Text>
              </>
            ) : (
              <Text style={styles.explanation}>
                {visibleProximity ? '閲覧できるか確認しています。' : '現在地を取得すると、投稿までの距離と方角を確認できます。'}
              </Text>
            )}
          </>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: uiColors.background },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 20, gap: 20 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: uiColors.text },
  card: { padding: 20, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: uiColors.border, backgroundColor: uiColors.surface },
  label: { fontSize: 14, fontWeight: '600', color: uiColors.primary },
  distance: { fontSize: 18, color: uiColors.text },
  distanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  direction: { fontSize: 16, color: uiColors.primary },
  distanceNumber: { fontSize: 34, fontWeight: '700', color: uiColors.text, fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: uiColors.border, marginVertical: 4 },
  explanation: { fontSize: 14, lineHeight: 22, color: uiColors.text },
  remaining: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: uiColors.primary },
  arrival: { alignItems: 'center', gap: 12 },
  arrivalTitle: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: uiColors.text },
  readButton: { minHeight: 44, paddingHorizontal: 20, paddingVertical: 10, justifyContent: 'center',
    alignItems: 'center', borderRadius: 10, backgroundColor: uiColors.primaryFill },
  back: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: uiColors.primaryFill },
  backText: { color: uiColors.onPrimary, fontSize: 15, fontWeight: '700' },
});
