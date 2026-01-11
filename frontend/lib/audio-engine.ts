// Audio Engine with Web Audio API
import { Clip, ClipParams, Take } from './types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private nodes: Map<string, AudioBufferSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  async loadAudioFromUrl(url: string): Promise<AudioBuffer> {
    if (this.audioBuffers.has(url)) {
      return this.audioBuffers.get(url)!;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
    this.audioBuffers.set(url, audioBuffer);
    return audioBuffer;
  }

  async loadAudioFromBlob(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }

  async playClip(clipId: string, offset: number, params: ClipParams, audioSource?: string | Blob) {
    if (!this.ctx || !audioSource) return;

    this.stopNode(clipId);

    let buffer: AudioBuffer;

    if (typeof audioSource === 'string') {
      buffer = await this.loadAudioFromUrl(audioSource);
    } else {
      buffer = await this.loadAudioFromBlob(audioSource);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Apply playback rate (speed)
    if (params.speed) {
      source.playbackRate.value = params.speed;
    }

    // Create gain node for volume
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = params.volume || 1.0;

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Store references
    this.nodes.set(clipId, source);
    this.gainNodes.set(clipId, gainNode);

    // Start playback
    source.start(0, offset);
  }

  stopNode(clipId: string) {
    const node = this.nodes.get(clipId);
    if (node) {
      try {
        node.stop();
      } catch (e) {
        // Already stopped
      }
      node.disconnect();
      this.nodes.delete(clipId);
    }

    const gainNode = this.gainNodes.get(clipId);
    if (gainNode) {
      gainNode.disconnect();
      this.gainNodes.delete(clipId);
    }
  }

  stopAll() {
    this.nodes.forEach((node, clipId) => {
      this.stopNode(clipId);
    });
  }

  updateVolume(clipId: string, volume: number) {
    const gainNode = this.gainNodes.get(clipId);
    if (gainNode) {
      gainNode.gain.value = volume;
    }
  }

  // Recording functionality
  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];

      let mimeType = 'audio/webm;codecs=opus';

      // Fallback for Safari
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }

      const options: MediaRecorderOptions = {
        mimeType,
      };

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });

        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }

        this.mediaRecorder = null;
        this.stream = null;

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  async getAudioDuration(blob: Blob): Promise<number> {
    const buffer = await this.loadAudioFromBlob(blob);
    return buffer.duration;
  }

  async generateWaveformPeaks(blob: Blob, numPeaks: number = 100): Promise<number[]> {
    const buffer = await this.loadAudioFromBlob(blob);
    const rawData = buffer.getChannelData(0);
    const samples = numPeaks;
    const blockSize = Math.floor(rawData.length / samples);
    const peaks: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let max = 0;

      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[start + j]);
        if (val > max) {
          max = val;
        }
      }

      peaks.push(max);
    }

    return peaks;
  }

  // Mix multiple clips (for export)
  async mixClips(clips: Array<{ buffer: AudioBuffer; start: number; gain: number }>): Promise<AudioBuffer> {
    if (!this.ctx) {
      throw new Error('Audio context not initialized');
    }

    // Calculate total duration
    const totalDuration = Math.max(...clips.map(c => c.start + c.buffer.duration));
    const sampleRate = this.ctx.sampleRate;
    const totalSamples = Math.ceil(totalDuration * sampleRate);

    // Create offline context for rendering
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

    // Add all clips
    clips.forEach(clip => {
      const source = offlineCtx.createBufferSource();
      source.buffer = clip.buffer;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = clip.gain;

      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      source.start(clip.start);
    });

    // Render
    return await offlineCtx.startRendering();
  }

  dispose() {
    this.stopAll();

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }

    this.audioBuffers.clear();
  }
}

// Singleton instance
export const audioManager = new AudioEngine();
