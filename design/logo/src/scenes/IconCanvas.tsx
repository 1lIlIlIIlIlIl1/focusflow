import React from 'react';
import {ZsIcon, ZsMark, ZsVariant} from '../brand/ZsMark';

/**
 * 单标识出图纸：画布尺寸即图标尺寸，纯静态（任意帧一致）。
 * icon=true 时输出瓦形图标（带底）；否则输出开放版标识。
 */
export const IconCanvas: React.FC<{
  size: number;
  variant: ZsVariant;
  small: boolean;
  icon: boolean;
  dark: boolean;
}> = ({size, variant, small, icon, dark}) => (
  <div
    style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
    }}
  >
    {icon ? (
      <ZsIcon size={size} small={small} dark={dark} gid="icon-grad" />
    ) : (
      <ZsMark variant={variant} size={size} gid="icon-grad" />
    )}
  </div>
);
