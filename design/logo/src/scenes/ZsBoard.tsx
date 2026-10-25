import React from 'react';
import {BRAND, ZS_VARIANTS, ZsMark} from '../brand/ZsMark';

const FONT = '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif';

const Row: React.FC<{v: (typeof ZS_VARIANTS)[number]; i: number}> = ({v, i}) => (
  <div
    style={{
      height: 190,
      borderRadius: 20,
      background: 'linear-gradient(100deg, #151922 0%, #10131a 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      padding: '0 34px',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      gap: 32,
    }}
  >
    <div
      style={{
        width: 146,
        height: 146,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <ZsMark variant={v.id} size={146} gid={`g${i}`} />
    </div>

    <div style={{width: 400, flexShrink: 0}}>
      <div style={{fontFamily: FONT, fontSize: 21, fontWeight: 700, color: '#fff'}}>{v.name}</div>
      <div style={{fontFamily: FONT, fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', marginTop: 10}}>
        {v.note}
      </div>
    </div>

    <div style={{flex: 1, paddingRight: 20}}>
      <div style={{fontFamily: FONT, fontSize: 14, lineHeight: 1.85, color: 'rgba(255,255,255,0.62)'}}>
        {v.concept}
      </div>
    </div>

    <div style={{display: 'flex', alignItems: 'flex-end', gap: 20, flexShrink: 0}}>
      {[48, 32, 16].map((s) => (
        <div key={s} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5}}>
          <div style={{height: 48, display: 'flex', alignItems: 'flex-end'}}>
            <ZsMark variant={v.id} size={s} gid={`g${i}`} />
          </div>
          <div style={{fontFamily: FONT, fontSize: 10.5, color: 'rgba(255,255,255,0.28)'}}>{s}</div>
        </div>
      ))}
    </div>
  </div>
);

/** Zs 概念方案对比（四行规格表） */
export const ZsBoard: React.FC = () => (
  <div
    style={{
      width: 1920,
      height: 1080,
      background: '#0a0c11',
      padding: '46px 80px 44px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 30}}>
      <div>
        <div style={{fontFamily: FONT, fontSize: 13, color: BRAND.gradMid, letterSpacing: 6, fontWeight: 600}}>
          ZSFOCUS · 第二版标识
        </div>
        <div style={{fontFamily: FONT, fontSize: 40, color: '#fff', fontWeight: 700, marginTop: 8}}>
          Z 求真 · s 求识
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 13,
          lineHeight: 1.95,
          color: 'rgba(255,255,255,0.36)',
          textAlign: 'right',
          maxWidth: 620,
        }}
      >
        Z ＝ 甄（甄别、去伪存真）· 臻（抵达）
        <br />
        s ＝ 求识；瓦形底取自「甄」的部首「瓦」，Z 立于瓦上
      </div>
    </div>

    <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
      {ZS_VARIANTS.map((v, i) => (
        <Row key={v.id} v={v} i={i} />
      ))}
    </div>

    <div style={{flex: 1}} />
    <div
      style={{
        fontFamily: FONT,
        fontSize: 13.5,
        lineHeight: 1.9,
        color: 'rgba(255,255,255,0.4)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingTop: 16,
      }}
    >
      采用建议：一（开放版）用于界面、海报与动效，二（瓦形版）用于工具栏图标——两者是同一套几何，只换底。
      s 在 24px 以下会收成一个点，这是字母在 16px 尺度的物理极限，不是缺陷；此时它读作「Z」，仍是一个完整标识。
    </div>
  </div>
);
