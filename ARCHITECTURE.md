# Auteur Video Editor - Architecture Documentation

## For AI Agents: Quick Start Guide 🤖

This document explains the codebase architecture to help AI agents understand, navigate, and modify the system effectively.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface (React)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   Header     │ │   Canvas     │ │  Properties  │       │
│  │  Component   │ │  Component   │ │    Panel     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Timeline Component                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ (React State)
┌─────────────────────────────────────────────────────────────┐
│                  State Management Layer                      │
│  - Clips (video, audio, dialogue, text, picture)           │
│  - Tracks (container for clips)                             │
│  - Speakers (voice profiles, colors)                        │
│  - Takes (multiple recordings per dialogue clip)            │
│  - Timeline state (zoom, current time, playback)            │
└─────────────────────────────────────────────────────────────┘
                          ↕ (Function Calls)
┌─────────────────────────────────────────────────────────────┐
│                     Core Engines                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │    Audio     │ │    Video     │ │   Effects    │       │
│  │   Engine     │ │   Exporter   │ │   System     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                          ↕ (Browser APIs)
┌─────────────────────────────────────────────────────────────┐
│                     Browser APIs                             │
│  - Web Audio API (audio processing)                         │
│  - Canvas API (video rendering)                             │
│  - MediaRecorder (microphone recording)                     │
│  - FFmpeg.wasm (video encoding)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
/frontend
├── app/
│   ├── page.tsx              # Main application (state + logic)
│   └── layout.tsx            # Root layout with fonts/styles
├── components/
│   └── editor/
│       ├── Header.tsx        # Top nav (export, speakers, ripple mode)
│       ├── Canvas.tsx        # Video preview + playback controls
│       ├── Timeline.tsx      # Multi-track timeline view
│       └── PropertiesPanel.tsx  # Clip property editor
├── lib/
│   ├── types.ts              # TypeScript interfaces (Clip, Track, etc.)
│   ├── audio-engine.ts       # Web Audio API wrapper
│   ├── video-export.ts       # FFmpeg.wasm video export
│   ├── effects.ts            # Clip rendering effects
│   ├── templates.ts          # Project templates
│   ├── logger.ts             # Logging system
│   ├── errors.ts             # Custom error classes
│   └── validation.ts         # Input validation utilities
└── public/                   # Static assets
```

---

## Key Files Explained

### 1. `/frontend/app/page.tsx` (1200+ lines)
**Purpose**: Main application component with all state and business logic

**Key State Variables**:
```typescript
const [clips, setClips] = useState<Clip[]>([]);           // All clips
const [tracks, setTracks] = useState<Track[]>([]);        // Timeline tracks
const [speakers, setSpeakers] = useState<Speaker[]>([]);  // Voice profiles
const [duration, setDuration] = useState(30);             // Project duration
const [currentTime, setCurrentTime] = useState(0);        // Playhead position
const [isPlaying, setIsPlaying] = useState(false);        // Playback state
const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
const [isExporting, setIsExporting] = useState(false);    // Export in progress
```

**Key Functions**:
- `renderFrame(time)` - Render current frame to canvas
- `addDialogueClip(trackId)` - Create new dialogue clip
- `updateClip(id, field, value)` - Update clip property
- `startRecording(clipId)` - Start microphone recording
- `stopRecording(clipId)` - Stop recording, create take
- `checkOverlap(clipId, start, duration)` - Validate clip placement
- `exportVideo()` - Export video with FFmpeg.wasm

**Error Handling**:
- Try-catch blocks around all async operations
- User-friendly error alerts
- Console logging for debugging

**AI Agent Notes**:
- All state mutations go through React setState
- Functions are pure (no hidden side effects)
- Clips are immutable (use .map() to update)

---

### 2. `/frontend/lib/types.ts` (300+ lines)
**Purpose**: TypeScript type definitions (single source of truth)

**Key Interfaces**:

```typescript
interface Clip {
  id: string;                      // Unique identifier
  trackId: string;                 // Parent track
  type: 'video' | 'audio' | 'picture' | 'dialogue' | 'text';
  name: string;                    // Display name
  start: number;                   // Start time (seconds)
  duration: number;                // Length (seconds)
  params: ClipParams;              // Effects parameters

  // Dialogue-specific
  speaker?: string;                // Speaker ID
  content?: string;                // Dialogue text
  scriptText?: string;             // Original script
  takes?: Take[];                  // Audio recordings
  activeTakeId?: string;           // Currently selected take
  isStale?: boolean;               // Text changed since recording

  // Media-specific
  src?: string;                    // File URL
  file?: File;                     // Original file object
}

interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'picture' | 'dialogue' | 'text';
  order: number;                   // Z-index (0 = bottom)
  mute: boolean;                   // Mute all clips
  volume?: number;                 // Track volume (0-2)
  rules?: TrackRules;              // Overlap rules
}

interface Speaker {
  id: string;
  name: string;
  color?: string;                  // Hex color for UI
  voiceProfile?: {
    pitch: number;                 // -1 to 1
    rate: number;                  // 0.5 to 2
    volume: number;                // 0 to 2
  };
}

interface Take {
  id: string;
  uri?: string;                    // Saved file URL
  blob?: Blob;                     // In-memory audio
  duration: number;                // Length (seconds)
  createdAt: number;               // Timestamp
  source: 'recording' | 'upload' | 'tts' | 'import';
  waveformPeaks?: number[];        // For visualization
}
```

**AI Agent Notes**:
- All types are strict (no `any`)
- Optional fields use `?`
- Union types for `type` fields
- Use these types for validation

---

### 3. `/frontend/lib/audio-engine.ts` (250+ lines)
**Purpose**: Web Audio API wrapper for audio operations

**Key Methods**:
```typescript
class AudioEngine {
  init(): AudioContext;
  async loadAudioFromUrl(url: string): Promise<AudioBuffer>;
  async loadAudioFromBlob(blob: Blob): Promise<AudioBuffer>;
  async playClip(clipId, offset, params, audioSource): Promise<void>;
  stopNode(clipId: string): void;
  stopAll(): void;
  updateVolume(clipId: string, volume: number): void;
  async startRecording(): Promise<void>;
  async stopRecording(): Promise<Blob>;
  isRecording(): boolean;
  async getAudioDuration(blob: Blob): Promise<number>;
  async generateWaveformPeaks(blob: Blob, numPeaks?): Promise<number[]>;
  async mixClips(clips: Array<{...}>): Promise<AudioBuffer>;
  dispose(): void;
}
```

**Error Scenarios**:
- Microphone permission denied → `AudioError.microphoneAccessDenied()`
- Audio decoding failed → `AudioError.decodingFailed()`
- Web Audio API not supported → `AudioError.contextInitFailed()`

**AI Agent Notes**:
- Singleton instance: `audioManager`
- Call `init()` before any audio operations
- Cache audio buffers for performance
- Always call `dispose()` when done

---

### 4. `/frontend/lib/video-export.ts` (340+ lines)
**Purpose**: FFmpeg.wasm-based video export

**Key Methods**:
```typescript
class VideoExporter {
  async load(onProgress?: (p: number) => void): Promise<void>;
  async exportVideo(canvas, clips, tracks, speakers, duration, fps, onProgress): Promise<Blob>;
  async exportSubtitles(clips: Clip[], speakers: Speaker[]): Promise<string>;
  async exportAudioStem(clips, tracks, duration): Promise<Blob>;
}
```

**Export Process**:
1. Load FFmpeg.wasm (~50MB download)
2. Render frames (0-50% progress)
   - Clear canvas
   - Draw all visible clips
   - Apply transforms (position, scale, rotation)
   - Capture RGBA pixels
3. Mix audio tracks (background)
4. Encode with FFmpeg (50-100% progress)
5. Return MP4 blob

**Error Scenarios**:
- FFmpeg not available (SSR) → `ExportError.ffmpegNotAvailable()`
- Frame rendering failed → `ExportError.frameRenderingFailed()`
- Audio mixing failed → `ExportError.audioMixingFailed()`
- FFmpeg encoding failed → `ExportError.encodingFailed()`

**AI Agent Notes**:
- Only works in browser (not SSR)
- First export is slow (loading FFmpeg)
- Progress callback for UI updates
- Auto-downloads video + subtitles + audio stem

---

### 5. `/frontend/lib/effects.ts` (200+ lines)
**Purpose**: Rendering functions for different clip types

**Interface**:
```typescript
interface Effect {
  name: string;
  description: string;
  controls?: EffectControl[];
  render: (ctx: CanvasRenderingContext2D,
           width: number,
           height: number,
           time: number,
           params: ClipParams,
           clip: Clip) => void;
}
```

**Built-in Effects**:
- `videoEffect` - Render video element
- `pictureEffect` - Render image element
- `dialogueEffect` - Text with speaker name
- `textEffect` - Simple text overlay
- `audioEffect` - Waveform visualization

**AI Agent Notes**:
- Effects are pure functions
- All rendering on 2D canvas
- Use `clip.params` for effect parameters
- Return nothing (mutates canvas)

---

### 6. `/frontend/lib/logger.ts` (NEW, 400+ lines)
**Purpose**: Structured logging for debugging and AI agents

**Usage**:
```typescript
import { logger, LogCategory } from './logger';

logger.debug(LogCategory.AUDIO, 'playClip', 'Starting audio playback', {
  clipId: 'abc123',
  volume: 0.8,
  speed: 1.0
});

logger.error(LogCategory.EXPORT, 'exportVideo', 'Export failed', error, {
  duration: 30,
  fps: 30
});
```

**Log Levels**:
- `DEBUG` - Variable values, function entry/exit
- `INFO` - Successful operations, milestones
- `WARN` - Potential issues, deprecations
- `ERROR` - Recoverable errors
- `FATAL` - Critical failures

**AI Agent Notes**:
- All logs are structured (JSON)
- Include context data for debugging
- Logs are buffered (exportable)
- Performance measurement utility

---

### 7. `/frontend/lib/errors.ts` (NEW, 400+ lines)
**Purpose**: Custom error classes with rich context

**Error Types**:
```typescript
// Audio errors
AudioError.microphoneAccessDenied(details)
AudioError.recordingFailed(reason, context)
AudioError.playbackFailed(clipId, reason)
AudioError.decodingFailed(source, error)
AudioError.contextInitFailed(error)

// Export errors
ExportError.ffmpegNotAvailable()
ExportError.ffmpegLoadFailed(error)
ExportError.frameRenderingFailed(frameNum, total, error)
ExportError.audioMixingFailed(clipCount, error)
ExportError.encodingFailed(command, error)

// File errors
FileError.fileNotFound(filename, path)
FileError.invalidFileType(filename, expected, actual)
FileError.fileReadFailed(filename, error)
FileError.fileTooLarge(filename, size, maxSize)

// Validation errors
ValidationError.invalidInput(field, value, constraints)
ValidationError.clipOverlap(clipId, trackId, start, end)
ValidationError.missingRequiredField(field, context)
ValidationError.outOfBounds(value, min, max, field)

// Network errors
NetworkError.requestFailed(url, method, status, statusText)
NetworkError.timeout(url, timeoutMs)
NetworkError.offline()

// State errors
StateError.invalidTransition(from, to, reason)
StateError.clipNotFound(clipId)
StateError.trackNotFound(trackId)
```

**AI Agent Notes**:
- All errors extend `AppError`
- Errors have `code`, `category`, `context`, `timestamp`
- Errors are auto-logged
- `recoverable` flag indicates retry feasibility
- Use `getUserFriendlyMessage(error)` for UI

---

### 8. `/frontend/lib/validation.ts` (NEW, 300+ lines)
**Purpose**: Input validation before state mutations

**Validation Functions**:
```typescript
validateClip(clip: Partial<Clip>, operation: 'create' | 'update'): void
validateTrack(track: Partial<Track>, operation: 'create' | 'update'): void
validateSpeaker(speaker: Partial<Speaker>, operation: 'create' | 'update'): void
validateTake(take: Partial<Take>, operation: 'create' | 'update'): void
validateFile(file: File, allowedTypes: string[], maxSizeMB: number): void
checkClipOverlap(clip, newStart, newDuration, allClips, tracks): boolean
sanitizeString(input: string, maxLength?: number): string
validateExportDuration(duration: number): void
validateFPS(fps: number): void
```

**AI Agent Notes**:
- Always validate before mutating state
- Throws `ValidationError` on failure
- Check overlap for dialogue tracks
- Sanitize user input (XSS prevention)

---

## State Management Patterns

### Reading State
```typescript
// ✅ Good: Read from props/state
const clip = clips.find(c => c.id === clipId);

// ❌ Bad: Assume state exists
const clip = clips[0]; // May be undefined
```

### Updating State
```typescript
// ✅ Good: Immutable update
setClips(prevClips => prevClips.map(c =>
  c.id === clipId ? { ...c, volume: 0.5 } : c
));

// ❌ Bad: Mutate state directly
clips[0].volume = 0.5; // React won't re-render
setClips(clips); // Still same reference
```

### Adding Items
```typescript
// ✅ Good: Create new array
setClips(prevClips => [...prevClips, newClip]);

// ❌ Bad: Mutate array
clips.push(newClip);
setClips(clips);
```

### Removing Items
```typescript
// ✅ Good: Filter immutably
setClips(prevClips => prevClips.filter(c => c.id !== clipId));

// ❌ Bad: Mutate array
const index = clips.findIndex(c => c.id === clipId);
clips.splice(index, 1);
setClips(clips);
```

---

## Common Operations

### Create a New Dialogue Clip
```typescript
const newClip: Clip = {
  id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  trackId: dialogueTrackId,
  type: 'dialogue',
  name: 'Dialogue 1',
  start: 0,
  duration: 5,
  params: {
    volume: 1.0,
    opacity: 1.0,
    speed: 1.0,
    scaleX: 1.0,
    scaleY: 1.0,
  },
  speaker: speakerId,
  content: 'Hello, world!',
  scriptText: 'Hello, world!',
  takes: [],
};

// Validate
validateClip(newClip, 'create');

// Check overlap
const hasOverlap = checkClipOverlap(newClip, newClip.start, newClip.duration, clips, tracks);
if (hasOverlap) {
  throw ValidationError.clipOverlap(newClip.id, newClip.trackId, newClip.start, newClip.start + newClip.duration);
}

// Add to state
setClips(prev => [...prev, newClip]);
```

### Record Audio Take
```typescript
// Start recording
await audioManager.startRecording();
setIsRecording(true);

// ... user records audio ...

// Stop recording
const blob = await audioManager.stopRecording();
const duration = await audioManager.getAudioDuration(blob);
const waveformPeaks = await audioManager.generateWaveformPeaks(blob);

const newTake: Take = {
  id: `take_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  blob,
  duration,
  createdAt: Date.now(),
  source: 'recording',
  waveformPeaks,
};

// Validate
validateTake(newTake, 'create');

// Add to clip
setClips(prev => prev.map(c => {
  if (c.id === clipId) {
    return {
      ...c,
      takes: [...(c.takes || []), newTake],
      activeTakeId: newTake.id,
    };
  }
  return c;
}));

setIsRecording(false);
```

### Export Video
```typescript
try {
  setIsExporting(true);
  setExportProgress(0);

  // Validate
  validateExportDuration(duration);
  validateFPS(fps);

  // Export
  const videoBlob = await videoExporter.exportVideo(
    canvasRef.current,
    clips,
    tracks,
    speakers,
    duration,
    fps,
    (progress) => setExportProgress(progress)
  );

  // Download
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `video-${Date.now()}.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Export subtitles
  const srt = await videoExporter.exportSubtitles(clips, speakers);
  // ... download srt ...

  // Export audio stem
  const audioBlob = await videoExporter.exportAudioStem(clips, tracks, duration);
  // ... download audio ...

} catch (error) {
  const userMessage = getUserFriendlyMessage(error);
  alert(userMessage);
  logger.error(LogCategory.EXPORT, 'exportVideo', 'Export failed', error);
} finally {
  setIsExporting(false);
  setExportProgress(0);
}
```

---

## Error Handling Patterns

### Try-Catch with Logging
```typescript
try {
  await riskyOperation();
  logger.info(LogCategory.AUDIO, 'operation', 'Operation succeeded');
} catch (error) {
  logger.error(LogCategory.AUDIO, 'operation', 'Operation failed', error as Error);
  throw error; // Re-throw or handle
}
```

### Async Error Wrapper
```typescript
import { handleAsyncError } from './errors';

const result = await handleAsyncError(
  () => riskyOperation(),
  'Failed to complete operation',
  { clipId, userId }
);
```

### User-Friendly Errors
```typescript
catch (error) {
  const message = getUserFriendlyMessage(error);
  alert(message); // Or toast notification
  logger.error(LogCategory.UI, 'operation', 'User-facing error', error);
}
```

---

## Performance Considerations

### Rendering Loop (60 FPS target)
- Use `requestAnimationFrame` for smooth rendering
- Keep render logic < 16ms per frame
- Cache expensive calculations
- Use refs for values that don't trigger re-renders

### Audio Playback
- Preload audio buffers (avoid loading during playback)
- Use `OfflineAudioContext` for mixing (faster than real-time)
- Limit concurrent audio nodes (< 10)

### Timeline with Many Clips
- Virtual scrolling for 1000+ clips
- Render only visible clip range
- Debounce drag operations
- Use `React.memo` for clip components

### Memory Management
- Dispose audio buffers when not needed
- Revoke blob URLs after use
- Clear canvas between frames
- Limit undo history (< 50 actions)

---

## Testing Strategy

### Unit Tests
- Test validation functions
- Test error classes
- Test logger utilities
- Test pure functions (effects)

### Integration Tests
- Test audio engine operations
- Test video export process
- Test state management logic

### E2E Tests (Playwright)
- Create project → Add clips → Export video
- Record dialogue → Edit → Export
- Multi-track editing workflow

---

## Debugging Tips for AI Agents

### Check Logs
```typescript
// Export recent logs
console.log(logger.exportLogs());

// Get last 10 logs
console.log(logger.getRecentLogs(10));
```

### Inspect State
```typescript
// In browser console
window.DEBUG = { clips, tracks, speakers, currentTime, duration };
```

### Validate State
```typescript
// Check for invalid state
clips.forEach(clip => {
  try {
    validateClip(clip, 'update');
  } catch (error) {
    console.error('Invalid clip:', clip.id, error);
  }
});
```

### Performance Profiling
```typescript
// Measure operation performance
const result = await logger.measurePerformance(
  LogCategory.EXPORT,
  'exportVideo',
  () => videoExporter.exportVideo(...)
);
```

---

## Contributing Guidelines

### Before Making Changes
1. Read this architecture doc
2. Understand the feature requirements
3. Check existing patterns
4. Plan the changes

### While Making Changes
1. Follow TypeScript strictly (no `any`)
2. Use existing error classes
3. Add logging to new functions
4. Validate inputs
5. Write tests

### After Making Changes
1. Test manually
2. Check console for errors/warnings
3. Run build (`npm run build`)
4. Update documentation
5. Create pull request

---

## FAQ for AI Agents

**Q: Where is the main application logic?**
A: `/frontend/app/page.tsx` - contains all state and business logic

**Q: How do I add a new clip type?**
A: 1. Add to `Clip['type']` union in `types.ts`, 2. Create effect in `effects.ts`, 3. Add rendering logic in `page.tsx`

**Q: How do I add a new error type?**
A: Extend `AppError` in `errors.ts`, follow existing pattern

**Q: Where are audio operations?**
A: `audioManager` singleton in `/frontend/lib/audio-engine.ts`

**Q: Where is video export?**
A: `videoExporter` singleton in `/frontend/lib/video-export.ts`

**Q: How do I validate user input?**
A: Use functions from `/frontend/lib/validation.ts`

**Q: How do I log operations?**
A: Use `logger` from `/frontend/lib/logger.ts`, specify category and operation

**Q: Why are some files `.refactored.ts`?**
A: New files with better error handling/logging. Will replace originals after testing.

**Q: Can I mutate state directly?**
A: No! Always use `setState` with immutable updates (map, filter, spread)

**Q: How do I test locally?**
A: `cd frontend && npm install && npm run dev` → http://localhost:3000

---

**Last Updated**: 2026-01-11
**For**: AI Agents & Human Developers
**Version**: 0.1.0
