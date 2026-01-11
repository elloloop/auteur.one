// Project templates for quick start
import { Track, Clip, Speaker } from './types';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'podcast' | 'video' | 'audiobook' | 'tutorial' | 'blank';
  icon: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  tracks: Omit<Track, 'id'>[];
  speakers?: Speaker[];
  sampleClips?: Omit<Clip, 'id'>[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start with an empty canvas',
    category: 'blank',
    icon: '📄',
    duration: 60,
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [],
  },
  {
    id: 'podcast',
    name: 'Podcast Episode',
    description: 'Multi-speaker podcast with intro/outro music',
    category: 'podcast',
    icon: '🎙️',
    duration: 1800, // 30 minutes
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [
      {
        name: 'Dialogue',
        type: 'dialogue',
        order: 1,
        mute: false,
        volume: 1.0,
        bus: 'dialogue',
        rules: {
          overlap_policy: 'disallow',
          default_gap_ms: 200,
          snap: true,
          ripple_mode: false,
        },
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Music',
        type: 'audio',
        order: 2,
        mute: false,
        volume: 0.3,
        bus: 'music',
        ui: {
          collapsed: false,
          height_px: 64,
        },
      },
      {
        name: 'Sound Effects',
        type: 'audio',
        order: 3,
        mute: false,
        volume: 0.8,
        bus: 'sfx',
        ui: {
          collapsed: false,
          height_px: 64,
        },
      },
    ],
    speakers: [
      {
        id: 'host',
        name: 'Host',
        voiceProfile: {
          pitch: 0,
          rate: 1.0,
          volume: 1.0,
        },
        color: '#3b82f6',
      },
      {
        id: 'guest',
        name: 'Guest',
        voiceProfile: {
          pitch: 0,
          rate: 1.0,
          volume: 1.0,
        },
        color: '#8b5cf6',
      },
    ],
  },
  {
    id: 'tutorial',
    name: 'Tutorial Video',
    description: 'Screen recording with voiceover and captions',
    category: 'tutorial',
    icon: '🎓',
    duration: 600, // 10 minutes
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [
      {
        name: 'Screen Recording',
        type: 'video',
        order: 1,
        mute: false,
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Voiceover',
        type: 'dialogue',
        order: 2,
        mute: false,
        volume: 1.0,
        bus: 'dialogue',
        rules: {
          overlap_policy: 'allow',
          default_gap_ms: 100,
        },
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Background Music',
        type: 'audio',
        order: 3,
        mute: false,
        volume: 0.2,
        bus: 'music',
        ui: {
          collapsed: false,
          height_px: 64,
        },
      },
    ],
    speakers: [
      {
        id: 'narrator',
        name: 'Narrator',
        voiceProfile: {
          pitch: 0,
          rate: 1.0,
          volume: 1.0,
        },
        color: '#10b981',
      },
    ],
  },
  {
    id: 'audiobook',
    name: 'Audiobook',
    description: 'Single narrator with chapter markers',
    category: 'audiobook',
    icon: '📚',
    duration: 3600, // 1 hour
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [
      {
        name: 'Narration',
        type: 'dialogue',
        order: 1,
        mute: false,
        volume: 1.0,
        bus: 'dialogue',
        rules: {
          overlap_policy: 'disallow',
          default_gap_ms: 500,
          snap: true,
        },
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Ambient Sound',
        type: 'audio',
        order: 2,
        mute: false,
        volume: 0.15,
        bus: 'ambient',
        ui: {
          collapsed: false,
          height_px: 64,
        },
      },
    ],
    speakers: [
      {
        id: 'narrator',
        name: 'Narrator',
        voiceProfile: {
          pitch: 0,
          rate: 0.95,
          volume: 1.0,
        },
        color: '#f59e0b',
      },
    ],
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Two-person conversation with video',
    category: 'video',
    icon: '🎬',
    duration: 1200, // 20 minutes
    fps: 30,
    width: 1920,
    height: 1080,
    tracks: [
      {
        name: 'Camera 1',
        type: 'video',
        order: 1,
        mute: false,
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Camera 2',
        type: 'video',
        order: 2,
        mute: false,
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Dialogue',
        type: 'dialogue',
        order: 3,
        mute: false,
        volume: 1.0,
        bus: 'dialogue',
        rules: {
          overlap_policy: 'allow',
          default_gap_ms: 150,
        },
        ui: {
          collapsed: false,
          height_px: 88,
        },
      },
      {
        name: 'Graphics',
        type: 'picture',
        order: 4,
        mute: false,
        ui: {
          collapsed: false,
          height_px: 64,
        },
      },
    ],
    speakers: [
      {
        id: 'interviewer',
        name: 'Interviewer',
        voiceProfile: {
          pitch: 0,
          rate: 1.0,
          volume: 1.0,
        },
        color: '#06b6d4',
      },
      {
        id: 'interviewee',
        name: 'Interviewee',
        voiceProfile: {
          pitch: 0,
          rate: 1.0,
          volume: 1.0,
        },
        color: '#ec4899',
      },
    ],
  },
];
