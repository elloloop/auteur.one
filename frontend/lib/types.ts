// Core type definitions for Auteur.one

export interface ClipParams {
  volume?: number;
  pitch?: number;
  speed?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  x?: number;
  y?: number;
  [key: string]: any;
}

export interface Take {
  id: string;
  uri?: string;
  blob?: Blob;
  duration: number;
  createdAt: number;
  source: 'recording' | 'upload' | 'tts' | 'import';
  waveformPeaks?: number[];
  loudness?: number;
  peak?: number;
  name?: string;
  isFavorite?: boolean;
}

export interface Transform {
  id: string;
  takeId: string;
  type: 'voice_conversion' | 'pitch_correction' | 'cleanup' | 'style_transfer';
  params: Record<string, any>;
  status: 'queued' | 'running' | 'done' | 'failed';
  outputUri?: string;
  createdAt: number;
  completedAt?: number;
}

export interface Speaker {
  id: string;
  name: string;
  voiceProfile?: {
    pitch: number;
    rate: number;
    volume: number;
    emotion?: string;
    style?: string;
  };
  color?: string;
  avatar?: string;
}

export interface Clip {
  id: string;
  trackId: string;
  type: 'video' | 'audio' | 'picture' | 'dialogue' | 'text';
  name: string;
  start: number;
  duration: number;
  params: ClipParams;

  // Media clips
  src?: string;
  file?: File;

  // Dialogue clips
  speaker?: string;
  content?: string;
  scriptText?: string;
  takes?: Take[];
  activeTakeId?: string;
  transforms?: Transform[];
  activeTransformId?: string;
  textVersionHash?: string;
  isStale?: boolean;

  // Text clips
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

export interface TrackRules {
  overlap_policy: 'allow' | 'disallow' | 'push' | 'trim';
  default_gap_ms: number;
  snap?: boolean;
  ripple_mode?: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'picture' | 'dialogue' | 'text';
  order: number;
  mute: boolean;
  solo?: boolean;
  locked?: boolean;
  volume?: number;
  pan?: number;
  bus?: string;
  rules?: TrackRules;
  ui?: {
    collapsed: boolean;
    height_px: number;
  };
}

export interface ProjectSettings {
  duration: number;
  fps: number;
  width: number;
  height: number;
  audioSampleRate: number;
  speakers: Speaker[];
  defaultSpeakerId?: string;
  rippleMode: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

export interface Marker {
  id: string;
  time: number;
  type: 'recording_start' | 'chapter' | 'hit_point' | 'custom';
  label: string;
  color?: string;
}

export interface ExportOptions {
  format: 'mp4' | 'webm' | 'wav' | 'mp3';
  quality: 'low' | 'medium' | 'high';
  includeDialogueStem: boolean;
  includeCueSheet: boolean;
  includeSubtitles: boolean;
  resolution?: { width: number; height: number };
  fps?: number;
  audioCodec?: string;
  videoCodec?: string;
  bitrate?: number;
}
