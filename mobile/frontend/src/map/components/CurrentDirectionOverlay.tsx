import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

export type CurrentPositionAnchor = { x: number; y: number; bearing: number };

const SIZE = 112;

export function CurrentDirectionOverlay({ anchor, heading }: {
  anchor: CurrentPositionAnchor;
  heading: number;
}) {
  const targetAngle = heading - anchor.bearing;
  const rotation = useRef(new Animated.Value(targetAngle)).current;
  const rotationStyle = useMemo(() => rotation.interpolate({
    inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend',
  }), [rotation]);

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    rotation.stopAnimation(value => {
      if (!active) return;
      // いま見えている角度から、0度の境界を越えても短い方向へ回す。
      const delta = ((targetAngle - value) % 360 + 540) % 360 - 180;
      if (Math.abs(delta) < 0.01) return;
      animation = Animated.timing(rotation, {
        // 回転の途中値をJS側で読み、センサー更新だけで次の回転を開始する。
        toValue: value + delta, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      });
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [rotation, targetAngle]);

  return (
    <View pointerEvents="none" style={[styles.cone, {
      left: `${anchor.x * 100}%`,
      top: `${anchor.y * 100}%`,
    }]}>
      <Animated.View style={{ transform: [{ rotate: rotationStyle }] }}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 112 112">
          <Defs>
            <RadialGradient id="heading-fade" cx="56" cy="56" r="56" gradientUnits="userSpaceOnUse">
              <Stop offset="15%" stopColor="#147DF1" stopOpacity={0.42} />
              <Stop offset="100%" stopColor="#147DF1" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* 中心の青い点を避け、点のふちから方角の扇形を広げる。 */}
          <Path d="M24.69 9.57 A56 56 0 0 1 87.31 9.57 L61.59 47.71 A10 10 0 0 0 50.41 47.71 Z"
            fill="url(#heading-fade)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cone: { position: 'absolute', width: SIZE, height: SIZE, marginLeft: -SIZE / 2, marginTop: -SIZE / 2 },
});
