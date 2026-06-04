// Line-glyph icon set, ported verbatim from the prototype (ui.jsx).
import type { CSSProperties } from 'react';

export const ICON_PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  bag: 'M6 8h12l-1 12H7L6 8ZM9 8V6a3 3 0 0 1 6 0v2',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  heart: 'M12 20S4 14.5 4 8.8A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 1.8C20 14.5 12 20 12 20Z',
  pin: 'M12 21s7-6.4 7-11A7 7 0 0 0 5 10c0 4.6 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  sliders: 'M4 7h11M19 7h1M4 17h6M14 17h6M15 4v6M10 14v6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L19 18l-1 3a16 16 0 0 1-14-14Z',
  message: 'M4 5h16v11H8l-4 4V5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
  card: 'M3 6h18v12H3V6ZM3 10h18M7 15h4',
  cash: 'M3 7h18v10H3V7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0',
  gift: 'M4 11h16v9H4v-9ZM3 7h18v4H3V7ZM12 7V20M12 7S9 7 9 5a2 2 0 0 1 3-1 2 2 0 0 1 3 1c0 2-3 2-3 2Z',
  tag: 'M3 12 12 3h8v8l-9 9-8-8ZM16 8h.01',
  percent: 'M7 7h.01M17 17h.01M6 18 18 6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 12l-1 2 2 2M20 12l1 2-2 2M12 4l2-1 2 2M12 20l2 1 2-2',
  logout: 'M14 4h5v16h-5M9 8l-4 4 4 4M5 12h10',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
  store: 'M4 9 5 4h14l1 5M4 9h16M4 9v11h16V9M9 20v-6h6v6',
  camera: 'M4 8h3l2-2h6l2 2h3v12H4V8ZM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  turnleft: 'M15 20v-7a4 4 0 0 0-4-4H6M9 5 5 9l4 4',
  turnright: 'M9 20v-7a4 4 0 0 1 4-4h5M15 5l4 4-4 4',
  straight: 'M12 20V5M7 10l5-5 5 5',
  scooter:
    'M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 16h8l2-7h2M13 9 12 6h-3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5h.01',
  calendar: 'M4 6h16v15H4V6ZM4 10h16M8 3v4M16 3v4',
  apple:
    'M16 13c0 3 2 4 2 4s-1.3 3-3 3c-1 0-1.5-.6-2.5-.6S10.5 20 9.5 20c-2 0-4-3.5-4-7 0-3 2-4.5 3.5-4.5 1 0 2 .7 2.5.7s1.3-.8 2.7-.8c1.7 0 2.8 1.2 3.3 2.1-1.5.8-1.5 2.4-1.5 2.5ZM12.5 6.5C13 6 13.4 5 13.3 4c-1 .1-1.8.6-2.3 1.2-.4.5-.8 1.4-.7 2.3 1-.1 1.7-.5 2.2-1Z',
  google: '',
  flame: 'M12 21c3.3 0 6-2.4 6-5.7 0-3.7-3-5.8-3-9.3-2 1-3 3-3 3S9.5 7 9 5.5C7.5 7 6 9.3 6 12c0 .8 0 5 6 9Z',
  star: 'star',
  bookmark: 'M6 4h12v16l-6-4-6 4V4Z',
};

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 22,
  color = 'currentColor',
  fill = false,
  strokeWidth = 1.8,
  style = {},
}: IconProps) {
  if (name === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <path
          d="M12 3.2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.6 6.8 19.3l1-5.8L3.5 9.4l5.9-.9L12 3.2Z"
          fill={fill ? color : 'none'}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d={ICON_PATHS[name] || ''}
        stroke={color}
        fill={fill ? color : 'none'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
