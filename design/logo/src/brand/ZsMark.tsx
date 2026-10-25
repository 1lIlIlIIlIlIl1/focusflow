import React from 'react';

/**
 * ZsFocus 标识（第二版）：主体是 Zs 双字母。
 *
 * 语义：
 *   Z —— 求真 / 臻 / 甄。字形全是直角，代表甄别、去伪存真，容不得含糊。
 *   s —— 求识。字形全是曲线，代表求索、开放、尚且未知。
 *   底瓦（圆角方块）—— 「甄」字从「瓦」，瓦片正是甄字的部首。
 *   两者的交接就是「识」发生在「真」的边界上。
 */
export const BRAND = {
  gradFrom: '#ffa961',
  gradMid: '#ff7a4d',
  gradTo: '#ff5468',
  ink: '#0b0d12',
  paper: '#ffffff',
  warm: '#ffd9c6',
};

export type ZsVariant = 'flow' | 'tile' | 'bold' | 'stack';

export const ZS_VARIANTS: {
  id: ZsVariant;
  name: string;
  concept: string;
  note: string;
}[] = [
  {
    id: 'flow',
    name: '一 · 厚 Z 细 s（开放版）',
    concept: 'Z 用 11.5 号笔画（求真之确定），s 用 5 号细线（求识之未定），s 的收笔落在 Z 的底横上',
    note: '重量差就是语义差：真知要重，求知要轻。16px 下细线自然收成一个点，只剩干净的 Z',
  },
  {
    id: 'tile',
    name: '二 · 瓦上 Zs（图标版）',
    concept: '渐变瓦形底（「甄」字从「瓦」）＋ 白 Z，右下嵌入暖色 s',
    note: '同一套几何换皮：实心底让它在工具栏里最抓眼，s 用暖色而不是纯白，弱化但不消失',
  },
  {
    id: 'bold',
    name: '三 · 等重 Zs',
    concept: 's 与 Z 同粗，两字母分量相当，最接近排版意义上的连字',
    note: '字母最完整，但 Z 的斜笔与 s 抢夺注意力，远看像一团',
  },
  {
    id: 'stack',
    name: '四 · 上下 Zs（未采用）',
    concept: 'Z 与 s 上下叠合，共用一条横线',
    note: '试过但不成立：s 的正面曲线叠在 Z 下方，会被读成「Z3」',
  },
];

const GRAD = (id: string, from = BRAND.gradFrom, to = BRAND.gradTo) => (
  <linearGradient id={id} x1="14%" y1="0%" x2="86%" y2="100%">
    <stop offset="0%" stopColor={from} />
    <stop offset="52%" stopColor={BRAND.gradMid} />
    <stop offset="100%" stopColor={to} />
  </linearGradient>
);

/** Z 的骨架：上横、斜笔、下横，全直角 */
const Z_D = 'M 21 25 H 71 L 21 71 H 71';

/** s：上碗朝左、下碗朝右，收笔落在 Z 的底横上 */
const S_D = 'M 77 41 C 63 41 61 53 69 54 C 77 55 77 69 63 71';

export const ZsMark: React.FC<{variant?: ZsVariant; size?: number; gid?: string}> = ({
  variant = 'flow',
  size = 128,
  gid = 'zs-grad',
}) => {
  const g = `url(#${gid})`;
  const base = {viewBox: '0 0 100 100', width: size, height: size} as const;

  if (variant === 'flow') {
    return (
      <svg {...base}>
        <defs>{GRAD(gid)}</defs>
        <path
          d={Z_D}
          fill="none"
          stroke={g}
          strokeWidth="11.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={S_D} fill="none" stroke={BRAND.paper} strokeWidth="5" strokeLinecap="round" opacity="0.95" />
      </svg>
    );
  }

  if (variant === 'tile') {
    return (
      <svg {...base}>
        <defs>{GRAD(gid)}</defs>
        <rect x="0" y="0" width="100" height="100" rx="23" fill={g} />
        <path
          d={Z_D}
          fill="none"
          stroke={BRAND.paper}
          strokeWidth="11.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={S_D} fill="none" stroke={BRAND.warm} strokeWidth="5.2" strokeLinecap="round" opacity="0.95" />
      </svg>
    );
  }

  if (variant === 'bold') {
    return (
      <svg {...base}>
        <defs>{GRAD(gid)}</defs>
        <path
          d={Z_D}
          fill="none"
          stroke={g}
          strokeWidth="11.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={S_D} fill="none" stroke={g} strokeWidth="10" strokeLinecap="round" />
      </svg>
    );
  }

  // stack（未采用，保留用于追溯）
  return (
    <svg {...base}>
      <defs>{GRAD(gid)}</defs>
      <path
        d="M 24 20 H 74 L 24 50 H 74"
        fill="none"
        stroke={g}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 74 56 C 52 56 48 66 62 66 C 76 66 72 78 48 78"
        fill="none"
        stroke={g}
        strokeWidth="10.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** 应用图标：瓦形底，小尺寸加粗 Z；s 可独立控制显隐 */
export const ZsIcon: React.FC<{
  size?: number;
  gid?: string;
  small?: boolean;
  showS?: boolean;
  dark?: boolean;
}> = ({size = 128, gid = 'zs-icon-grad', small = false, showS, dark = false}) => {
  const g = `url(#${gid})`;
  const sw = small ? 15 : 11.8;
  const d = small ? 'M 25 31 H 75 L 25 69 H 75' : Z_D;
  const withS = showS === undefined ? !small : showS;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>{GRAD(gid)}</defs>
      <rect x="0" y="0" width="100" height="100" rx="23" fill={dark ? BRAND.ink : g} />
      <path d={d} fill="none" stroke={BRAND.paper} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {withS && <path d={S_D} fill="none" stroke={BRAND.warm} strokeWidth="5.2" strokeLinecap="round" opacity="0.95" />}
    </svg>
  );
};
