import React from 'react';
import {Composition} from 'remotion';
import {ZsBoard} from './scenes/ZsBoard';
import {ZsFinal} from './scenes/ZsFinal';
import {IconCanvas} from './scenes/IconCanvas';
import {LogoReveal} from './scenes/LogoReveal';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Zs 概念方案对比：remotion still ZsBoard out/board.png --frame=0 */}
    <Composition id="ZsBoard" component={ZsBoard} width={1920} height={1080} fps={30} durationInFrames={30} />

    {/* 最终标识确认图 */}
    <Composition id="ZsFinal" component={ZsFinal} width={1920} height={1080} fps={30} durationInFrames={30} />

    {/* 单标识出图：尺寸由 props 决定，用于导出 16/32/48/128/512 图标 */}
    <Composition
      id="IconCanvas"
      component={IconCanvas}
      width={512}
      height={512}
      fps={30}
      durationInFrames={30}
      defaultProps={{size: 512, variant: 'flow' as const, small: false, icon: true, dark: false}}
      calculateMetadata={({props}) => ({
        width: props.size,
        height: props.size,
      })}
    />

    {/* 品牌动效：瓦形落位 + Z 逐笔画出 + s 收笔 + 字标浮现 */}
    <Composition id="LogoReveal" component={LogoReveal} width={1080} height={1080} fps={30} durationInFrames={100} />
  </>
);
