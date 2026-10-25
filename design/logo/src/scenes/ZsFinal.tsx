import React from 'react';
import {BRAND, ZsIcon, ZsMark} from '../brand/ZsMark';

const FONT = '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif';
const SIZES = [48, 32, 24, 20, 16];

const Toolbar: React.FC<{dark?: boolean}> = ({dark = true}) => (
  <div
    style={{
      height: 74,
      borderRadius: 14,
      background: dark ? '#23262e' : '#f1f2f5',
      display: 'flex',
      alignItems: 'center',
      padding: '0 22px',
      gap: 20,
      border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
    }}
  >
    {SIZES.map((s) => (
      <div key={s} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5}}>
        <div style={{height: 48, display: 'flex', alignItems: 'center'}}>
          <ZsIcon size={s} small={s <= 24} gid={`tb-${dark ? 'd' : 'l'}`} />
        </div>
        <div style={{fontFamily: FONT, fontSize: 11, color: dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.42)'}}>
          {s}
        </div>
      </div>
    ))}
    <div style={{flex: 1}} />
    <div style={{fontFamily: FONT, fontSize: 13, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)'}}>
      模拟 Edge 工具栏
    </div>
  </div>
);

/** 最终标识确认图：Zs 双字母主体 */
export const ZsFinal: React.FC = () => (
  <div
    style={{
      width: 1920,
      height: 1080,
      background: '#0a0c11',
      padding: '54px 80px 50px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
    }}
  >
    <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between'}}>
      <div>
        <div style={{fontFamily: FONT, fontSize: 13, color: BRAND.gradMid, letterSpacing: 6, fontWeight: 600}}>
          ZSFOCUS · FINAL MARK
        </div>
        <div style={{fontFamily: FONT, fontSize: 40, color: '#fff', fontWeight: 700, marginTop: 9}}>
          最终标识 · Zs
        </div>
      </div>
      <div style={{fontFamily: FONT, fontSize: 13, lineHeight: 1.95, color: 'rgba(255,255,255,0.34)', textAlign: 'right'}}>
        Z 求真 / 臻 / 甄 —— 直角，不容含糊
        <br />
        s 求识 —— 曲线，尚未抵达
      </div>
    </div>

    <div style={{display: 'flex', gap: 32, flex: 1, minHeight: 0}}>
      {/* 主标识 */}
      <div
        style={{
          width: 604,
          height: '100%',
          borderRadius: 24,
          background: 'linear-gradient(155deg, #171b24 0%, #0f1218 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
        }}
      >
        <ZsIcon size={262} gid="hero" />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 2}}>
          <span style={{fontFamily: FONT, fontSize: 72, fontWeight: 700, color: '#fff', letterSpacing: 1}}>Zs</span>
          <span
            style={{fontFamily: FONT, fontSize: 72, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: 1}}
          >
            Focus
          </span>
        </div>
        <div style={{fontFamily: FONT, fontSize: 15, letterSpacing: 8, color: 'rgba(255,255,255,0.34)'}}>
          求真 · 求识
        </div>
      </div>

      {/* 可用性验证 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 4,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{fontFamily: FONT, fontSize: 15, color: 'rgba(255,255,255,0.5)', letterSpacing: 2}}>
            开放版 · 无底色
          </div>
          <div style={{fontFamily: FONT, fontSize: 12.5, color: 'rgba(255,255,255,0.3)'}}>
            用于界面、海报、动效
          </div>
        </div>
        <div
          style={{
            height: 150,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 30,
            padding: '0 26px',
          }}
        >
          <ZsMark variant="flow" size={104} gid="open" />
          <ZsMark variant="flow" size={52} gid="open" />
          <ZsMark variant="flow" size={30} gid="open" />
          <div style={{flex: 1}} />
          <div style={{fontFamily: FONT, fontSize: 12.5, lineHeight: 1.85, color: 'rgba(255,255,255,0.3)'}}>
            104 / 52 / 30
            <br />
            细线 s 在大字时是主角
          </div>
        </div>

        <Toolbar dark />
        <Toolbar dark={false} />

        <div style={{display: 'flex', gap: 14, marginTop: 2}}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 16px',
            }}
          >
            <div style={{fontFamily: FONT, fontSize: 11.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7}}>
              单色
              <br />
              版
            </div>
            <svg viewBox="0 0 100 100" width="46" height="46">
              <rect width="100" height="100" rx="23" fill="#ffffff" />
              <path
                d="M 21 25 H 71 L 21 71 H 71"
                fill="none"
                stroke="#0b0d12"
                strokeWidth="11.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 77 41 C 63 41 61 53 69 54 C 77 55 77 69 63 71"
                fill="none"
                stroke="#0b0d12"
                strokeWidth="5.2"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>
            <svg viewBox="0 0 100 100" width="46" height="46">
              <rect width="100" height="100" rx="23" fill="#0b0d12" />
              <path
                d="M 21 25 H 71 L 21 71 H 71"
                fill="none"
                stroke="#ffffff"
                strokeWidth="11.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 77 41 C 63 41 61 53 69 54 C 77 55 77 69 63 71"
                fill="none"
                stroke="#ffffff"
                strokeWidth="5.2"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>
            <div style={{fontFamily: FONT, fontSize: 11.5, color: 'rgba(255,255,255,0.28)'}}>打印 / 反白</div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 16px',
            }}
          >
            {[
              {c: BRAND.gradFrom},
              {c: BRAND.gradMid},
              {c: BRAND.gradTo},
              {c: BRAND.warm},
            ].map((s) => (
              <div key={s.c} style={{display: 'flex', flexDirection: 'column', gap: 5}}>
                <div
                  style={{
                    width: 40,
                    height: 26,
                    borderRadius: 7,
                    background: s.c,
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
                <div style={{fontFamily: FONT, fontSize: 9.5, color: 'rgba(255,255,255,0.4)'}}>{s.c.slice(1)}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.06)',
            background: '#0e1015',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ZsIcon size={18} gid="inapp" />
          <span style={{fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#fff'}}>ZsFocus</span>
          <div style={{flex: 1}} />
          <span style={{fontFamily: FONT, fontSize: 12.5, color: 'rgba(255,255,255,0.45)'}}>界面顶栏 1:1</span>
        </div>
      </div>
    </div>
  </div>
);
