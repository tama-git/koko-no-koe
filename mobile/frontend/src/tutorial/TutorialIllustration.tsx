import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { TutorialIcon } from './tutorialPages';

const pinOutline = 'M40 63C32 55 22 46 22 34a18 18 0 0 1 36 0c0 12-10 21-18 29Z';
const pinWithHeart = <>
  <Path d={pinOutline} />
  <Path d="M40 45l-8-8a4.6 4.6 0 0 1 6.5-6.5L40 32l1.5-1.5A4.6 4.6 0 0 1 48 37Z" />
</>;

const illustrations = {
  welcome: pinWithHeart,
  map: <>
    <Path d="m13 25 18-8 18 8 18-8v39l-18 8-18-8-18 8Z" />
    <Path d="M31 17v39m18-31v39" />
  </>,
  range: <>
    <Ellipse cx="40" cy="61" rx="29" ry="11" strokeDasharray="3 5" />
    <G transform="translate(8 1) scale(.8)">
      <Path d={pinOutline} />
      <Circle cx="40" cy="34" r="5" />
    </G>
  </>,
  write: <>
    <Path d="M46 15H23a5 5 0 0 0-5 5v41a5 5 0 0 0 5 5h32a5 5 0 0 0 5-5V46M29 29h15M29 40h8M29 52h6" />
    <Path d="m43 51 3-10 17-17a4.5 4.5 0 0 1 6.4 6.4L52 48Zm16-23 6 6" />
  </>,
  book: <>
    <Path d="M40 26c-8-7-18-9-28-6v35c12-2 21 1 28 7 7-6 16-9 28-7V20c-10-3-20-1-28 6Zm0 0v36" />
    <Path d="M21 31c4 0 7 1 11 3m-11 7c4 0 7 1 11 3m16-10c4-2 7-3 11-3m-11 13c4-2 7-3 11-3" />
  </>,
  start: <>
    <G transform="translate(-5 4)">{pinWithHeart}</G>
    <Path d="M62 11v13m-6.5-6.5h13m-1 13.5v7m-3.5-3.5h7M17 14v7m-3.5-3.5h7" strokeWidth="2" />
  </>,
};

export function TutorialIllustration({ icon, size, color }: { icon: TutorialIcon; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" accessible={false}>
      <G fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {illustrations[icon]}
      </G>
    </Svg>
  );
}
