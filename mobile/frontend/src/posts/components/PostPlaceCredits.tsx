import { Linking, StyleSheet, Text, View } from 'react-native';
import type { PostPlaceAttribution } from '../postService';
import { uiColors } from '../../shared/uiColors';

const geoapifyCredit = { label: 'Powered by Geoapify', url: 'https://www.geoapify.com/' };
const openStreetMapCredit = { label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' };
const sourceLicenseLinks: Record<string, PostPlaceAttribution | undefined> = {
  'https://whosonfirst.org/': { label: 'Who’s On First ライセンス', url: 'https://www.whosonfirst.org/docs/licenses/' },
  'https://openaddresses.io/': { label: 'OpenAddresses 出典一覧', url: 'https://openaddresses.io/attribution/' },
};

// 一覧カードに、Geoapifyとその場所データ提供元の出典を短く表示する。
export function PostPlaceCreditLine({ source }: { source: PostPlaceAttribution }) {
  const license = source.url ? sourceLicenseLinks[source.url] : undefined;
  const label = source.url === openStreetMapCredit.url && source.label === openStreetMapCredit.label
    ? '© OpenStreetMap' : source.label;

  return (
    <View style={[styles.links, styles.compactLinks, styles.cardLinks]}>
      <Credit {...geoapifyCredit} compact inCard />
      <Credit label={label} url={license?.url ?? source.url} compact inCard />
    </View>
  );
}

// 場所データの出典を重複なく表示し、必要に応じてライセンスへのリンクも加える。
export function PostPlaceCredits({ sources, compact = false }: { sources: PostPlaceAttribution[]; compact?: boolean }) {
  if (!sources.length) return null;
  const credits = [...sources];
  if (compact) {
    if (!sources.some(source => source.url === openStreetMapCredit.url)) credits.push(openStreetMapCredit);
    for (const source of sources) {
      const license = source.url ? sourceLicenseLinks[source.url] : undefined;
      if (license) credits.push(license);
    }
  }
  const uniqueSources = new Map(credits.map(source => [JSON.stringify([source.label, source.url]), source]));
  return (
    <View style={[styles.links, compact && styles.compactLinks]}>
      <Credit {...geoapifyCredit} compact={compact} />
      {[...uniqueSources].map(([key, source]) => <Credit key={key} {...source} compact={compact} />)}
    </View>
  );
}

// 出典を表示し、URLがある場合はタップでリンクを開く。
function Credit({ label, url, compact, inCard = false }: PostPlaceAttribution & { compact: boolean; inCard?: boolean }) {
  const textStyle = [styles.text, compact && styles.compactText, inCard && styles.cardText];
  return url ? (
    <Text accessibilityRole="link" style={[textStyle, styles.link]}
      onPress={() => { void Linking.openURL(url).catch(() => {}); }}>{label}</Text>
  ) : <Text style={textStyle}>{label}</Text>;
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, marginTop: 8 },
  compactLinks: { rowGap: 2, marginTop: 2 },
  cardLinks: { marginTop: 0, paddingHorizontal: 12, paddingBottom: 8 },
  text: { fontSize: 12, color: uiColors.primary },
  compactText: { color: uiColors.primary, flexShrink: 1 },
  cardText: { fontSize: 10 },
  link: { textDecorationLine: 'underline' },
});
