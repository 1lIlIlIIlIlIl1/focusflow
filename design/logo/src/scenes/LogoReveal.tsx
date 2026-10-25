import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {BRAND} from '../brand/ZsMark';

const FONT = '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif';

/** 笔迹逐步画出：progress 0→1 时线段从无到有 */
const draw = (progress: number) => ({
  strokeDasharray: 1,
  strokeDashoffset: 1 - Math.max(0, Math.min(1, progress)),
  pathLength: 1,
});

const Z_D = 'M 21 25 H 71 L 21 71 H 71';
const S_D = 'M 77 41 C 63 41 61 53 69 54 C 77 55 77 69 63 71';

/**
 * 品牌动效：瓦落位（甄字从瓦）→ Z 三笔画出（求真）→ s 细线收笔（求识）→ 字标浮现。
 * 收尾画面与扩展图标完全一致；所有动画由 frame 驱动。
 */
export const LogoReveal: React.FC = () => {
  const f = useCurrentFrame();

  const glow = interpolate(f, [0, 22], [0, 1], {extrapolateRight: 'clamp'});
  const tile = interpolate(f, [6, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const tileScale = interpolate(tile, [0, 1], [0.88, 1]);

  const p1 = interpolate(f, [16, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const p2 = interpolate(f, [28, 44], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const p3 = interpolate(f, [42, 56], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const p4 = interpolate(f, [56, 74], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const word = interpolate(f, [66, 86], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lift = interpolate(word, [0, 1], [16, 0]);
  const tag = interpolate(f, [78, 98], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: '#0b0d12', alignItems: 'center', justifyContent: 'center'}}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 42%, rgba(255,110,80,0.15) 0%, rgba(11,13,18,0) 60%)',
          opacity: glow,
        }}
      />

      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
        <svg width="330" height="330" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="zs-reveal" x1="14%" y1="0%" x2="86%" y2="100%">
              <stop offset="0%" stopColor={BRAND.gradFrom} />
              <stop offset="52%" stopColor={BRAND.gradMid} />
              <stop offset="100%" stopColor={BRAND.gradTo} />
            </linearGradient>
          </defs>

          <g style={{opacity: tile, transform: `scale(${tileScale})`, transformOrigin: '50px 50px'}}>
            <rect x="0" y="0" width="100" height="100" rx="23" fill="url(#zs-reveal)" />
          </g>

          <path
            d="M 21 25 H 71"
            fill="none"
            stroke={BRAND.paper}
            strokeWidth="11.8"
            strokeLinecap="round"
            {...draw(p1)}
          />
          <path
            d="M 71 25 L 21 71"
            fill="none"
            stroke={BRAND.paper}
            strokeWidth="11.8"
            strokeLinecap="round"
            {...draw(p2)}
          />
          <path
            d="M 21 71 H 71"
            fill="none"
            stroke={BRAND.paper}
            strokeWidth="11.8"
            strokeLinecap="round"
            {...draw(p3)}
          />
          <path
            d={S_D}
            fill="none"
            stroke={BRAND.warm}
            strokeWidth="5.2"
            strokeLinecap="round"
            {...draw(p4)}
          />
        </svg>

        <div
          style={{
            fontFamily: FONT,
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: BRAND.paper,
            opacity: word,
            transform: `translateY(${lift}px)`,
          }}
        >
          ZsFocus
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 21,
            letterSpacing: 6,
            color: 'rgba(255,255,255,0.44)',
            opacity: tag,
            marginTop: -26,
          }}
        >
          求真 · 求识
        </div>
      </div>
    </AbsoluteFill>
  );
};
