// Effects system for different clip types
import { Clip, ClipParams } from './types';

export interface EffectControl {
  key: string;
  label: string;
  type: 'slider' | 'color' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  default: any;
}

export interface Effect {
  name: string;
  description: string;
  controls?: EffectControl[];
  render: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    params: ClipParams,
    clip: Clip
  ) => void;
}

// Video effect
const videoEffect: Effect = {
  name: 'Video',
  description: 'Render video frames',
  controls: [
    {
      key: 'scaleX',
      label: 'Scale X',
      type: 'slider',
      min: 0.1,
      max: 3,
      step: 0.1,
      default: 1,
    },
    {
      key: 'scaleY',
      label: 'Scale Y',
      type: 'slider',
      min: 0.1,
      max: 3,
      step: 0.1,
      default: 1,
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      default: 1,
    },
  ],
  render: (ctx, width, height, time, params, clip) => {
    if (!clip.src) return;

    ctx.save();

    // Apply transformations
    const scaleX = params.scaleX || 1;
    const scaleY = params.scaleY || 1;
    const opacity = params.opacity !== undefined ? params.opacity : 1;
    const x = params.x || 0;
    const y = params.y || 0;

    ctx.globalAlpha = opacity;
    ctx.translate(width / 2 + x, height / 2 + y);
    ctx.scale(scaleX, scaleY);

    // Draw placeholder (actual video rendering would use video element)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VIDEO: ' + clip.name, 0, 0);

    ctx.restore();
  },
};

// Picture effect
const pictureEffect: Effect = {
  name: 'Picture',
  description: 'Render static images',
  controls: [
    {
      key: 'scaleX',
      label: 'Scale X',
      type: 'slider',
      min: 0.1,
      max: 3,
      step: 0.1,
      default: 1,
    },
    {
      key: 'scaleY',
      label: 'Scale Y',
      type: 'slider',
      min: 0.1,
      max: 3,
      step: 0.1,
      default: 1,
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      default: 1,
    },
  ],
  render: (ctx, width, height, time, params, clip) => {
    ctx.save();

    const scaleX = params.scaleX || 1;
    const scaleY = params.scaleY || 1;
    const opacity = params.opacity !== undefined ? params.opacity : 1;
    const x = params.x || 0;
    const y = params.y || 0;

    ctx.globalAlpha = opacity;
    ctx.translate(width / 2 + x, height / 2 + y);
    ctx.scale(scaleX, scaleY);

    // Draw placeholder
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IMAGE: ' + clip.name, 0, 0);

    ctx.restore();
  },
};

// Dialogue effect
const dialogueEffect: Effect = {
  name: 'Dialogue',
  description: 'Render dialogue captions',
  controls: [
    {
      key: 'fontSize',
      label: 'Font Size',
      type: 'slider',
      min: 12,
      max: 72,
      step: 2,
      default: 24,
    },
    {
      key: 'yPosition',
      label: 'Y Position',
      type: 'slider',
      min: -200,
      max: 200,
      step: 10,
      default: 150,
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      default: 1,
    },
  ],
  render: (ctx, width, height, time, params, clip) => {
    if (!clip.content && !clip.scriptText) return;

    ctx.save();

    const fontSize = params.fontSize || 24;
    const yPosition = params.yPosition || 150;
    const opacity = params.opacity !== undefined ? params.opacity : 1;

    ctx.globalAlpha = opacity;
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = clip.content || clip.scriptText || '';
    const speakerText = clip.speaker ? `[${clip.speaker}] ` : '';

    // Draw background
    const textWidth = ctx.measureText(speakerText + text).width;
    const padding = 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      width / 2 - textWidth / 2 - padding,
      height / 2 + yPosition - fontSize / 2 - padding / 2,
      textWidth + padding * 2,
      fontSize + padding
    );

    // Draw speaker name
    if (clip.speaker) {
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.fillText(speakerText, width / 2 - textWidth / 2 + ctx.measureText(speakerText).width / 2, height / 2 + yPosition);
    }

    // Draw text
    ctx.fillStyle = '#fff';
    ctx.fillText(
      text,
      width / 2 + (clip.speaker ? ctx.measureText(speakerText).width / 2 : 0),
      height / 2 + yPosition
    );

    ctx.restore();
  },
};

// Text effect
const textEffect: Effect = {
  name: 'Text',
  description: 'Render text overlays',
  controls: [
    {
      key: 'fontSize',
      label: 'Font Size',
      type: 'slider',
      min: 12,
      max: 120,
      step: 2,
      default: 36,
    },
    {
      key: 'color',
      label: 'Color',
      type: 'color',
      default: '#ffffff',
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      default: 1,
    },
  ],
  render: (ctx, width, height, time, params, clip) => {
    if (!clip.text && !clip.content) return;

    ctx.save();

    const fontSize = params.fontSize || 36;
    const color = params.color || '#ffffff';
    const opacity = params.opacity !== undefined ? params.opacity : 1;
    const x = params.x || 0;
    const y = params.y || 0;

    ctx.globalAlpha = opacity;
    ctx.font = `${fontSize}px ${clip.fontFamily || 'Arial'}, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = clip.text || clip.content || '';
    ctx.fillText(text, width / 2 + x, height / 2 + y);

    ctx.restore();
  },
};

// Audio effect (no visual rendering, just placeholder)
const audioEffect: Effect = {
  name: 'Audio',
  description: 'Audio-only clip',
  controls: [],
  render: (ctx, width, height, time, params, clip) => {
    // Audio clips don't render visuals, but we can show a waveform placeholder
    ctx.save();
    ctx.fillStyle = '#4a5568';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🔊 ' + clip.name, width / 2, height / 2);
    ctx.restore();
  },
};

export const EFFECTS: Record<string, Effect> = {
  video: videoEffect,
  picture: pictureEffect,
  dialogue: dialogueEffect,
  text: textEffect,
  audio: audioEffect,
};
