/**
 * Audio Engine with Web Audio API
 *
 * Design Principles (SOLID):
 * - Single Responsibility: Handles only audio-related operations
 * - Open/Closed: Extensible through inheritance/composition
 * - Liskov Substitution: Can be replaced with mock implementation for testing
 * - Interface Segregation: Clean public API, private implementation details
 * - Dependency Inversion: Depends on Web Audio API abstractions
 *
 * Features:
 * - Audio playback with speed/volume control
 * - Microphone recording with format fallbacks
 * - Waveform generation for visualization
 * - Audio mixing for export
 * - Comprehensive error handling and logging
 */

import { Clip, ClipParams, Take } from './types';
import { AudioError } from './errors';
import { logger, LogCategory, createScopedLogger } from './logger';

const audioLogger = createScopedLogger(LogCategory.AUDIO, 'AudioEngine');

interface AudioNode {
    source: AudioBufferSourceNode;
    gain: GainNode;
}

interface RecordingState {
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    startTime: number;
}

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private activeNodes: Map<string, AudioNode> = new Map();
    private audioBufferCache: Map<string, AudioBuffer> = new Map();
    private recordingState: RecordingState | null = null;

    /**
     * Initialize Audio Context
     * Creates or resumes the Web Audio API context
     */
    init(): AudioContext {
        audioLogger.debug('Initializing audio context');

        try {
            if (!this.ctx) {
                // @ts-ignore - webkit prefix for Safari
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;

                if (!AudioContextClass) {
                    throw AudioError.contextInitFailed(new Error('Web Audio API not supported'));
                }

                this.ctx = new AudioContextClass();
                audioLogger.info('Audio context initialized successfully', {
                    sampleRate: this.ctx.sampleRate,
                    state: this.ctx.state,
                });
            }

            // Resume if suspended (common after user interaction)
            if (this.ctx.state === 'suspended') {
                audioLogger.debug('Resuming suspended audio context');
                this.ctx.resume().catch(error => {
                    audioLogger.error('Failed to resume audio context', error);
                });
            }

            return this.ctx;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.fatal('Failed to initialize audio context', err);
            throw AudioError.contextInitFailed(err);
        }
    }

    /**
     * Get current Audio Context
     */
    getContext(): AudioContext | null {
        return this.ctx;
    }

    /**
     * Load audio from URL with caching
     */
    async loadAudioFromUrl(url: string): Promise<AudioBuffer> {
        audioLogger.debug('Loading audio from URL', { url });

        // Check cache
        if (this.audioBufferCache.has(url)) {
            audioLogger.debug('Audio buffer found in cache', { url });
            return this.audioBufferCache.get(url)!;
        }

        try {
            if (!this.ctx) {
                this.init();
            }

            // Fetch audio file
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            audioLogger.debug('Audio file fetched successfully', {
                url,
                size: arrayBuffer.byteLength,
            });

            // Decode audio data
            const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);

            audioLogger.info('Audio decoded successfully', {
                url,
                duration: audioBuffer.duration,
                channels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate,
            });

            // Cache the buffer
            this.audioBufferCache.set(url, audioBuffer);

            return audioBuffer;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.error('Failed to load audio from URL', err, { url });
            throw AudioError.decodingFailed(url, err);
        }
    }

    /**
     * Load audio from Blob (for recordings/uploads)
     */
    async loadAudioFromBlob(blob: Blob): Promise<AudioBuffer> {
        audioLogger.debug('Loading audio from blob', {
            size: blob.size,
            type: blob.type,
        });

        try {
            if (!this.ctx) {
                this.init();
            }

            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);

            audioLogger.info('Audio blob decoded successfully', {
                duration: audioBuffer.duration,
                channels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate,
            });

            return audioBuffer;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.error('Failed to decode audio blob', err, {
                blobSize: blob.size,
                blobType: blob.type,
            });
            throw AudioError.decodingFailed('blob', err);
        }
    }

    /**
     * Play audio clip with speed/volume control
     */
    async playClip(
        clipId: string,
        offset: number,
        params: ClipParams,
        audioSource?: string | Blob
    ): Promise<void> {
        audioLogger.debug('Playing audio clip', {
            clipId,
            offset,
            speed: params.speed,
            volume: params.volume,
            hasSource: !!audioSource,
        });

        try {
            if (!this.ctx || !audioSource) {
                audioLogger.warn('Cannot play clip: missing context or source', {
                    clipId,
                    hasContext: !!this.ctx,
                    hasSource: !!audioSource,
                });
                return;
            }

            // Stop any existing playback for this clip
            this.stopNode(clipId);

            // Load audio buffer
            const buffer =
                typeof audioSource === 'string'
                    ? await this.loadAudioFromUrl(audioSource)
                    : await this.loadAudioFromBlob(audioSource);

            // Create source node
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;

            // Apply playback rate (speed)
            source.playbackRate.value = params.speed || 1.0;

            // Create gain node for volume
            const gainNode = this.ctx.createGain();
            gainNode.gain.value = params.volume || 1.0;

            // Connect audio graph
            source.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            // Store references
            this.activeNodes.set(clipId, { source, gain: gainNode });

            // Start playback
            source.start(0, offset);

            audioLogger.info('Audio clip started', {
                clipId,
                offset,
                duration: buffer.duration,
            });

            // Clean up when playback ends
            source.onended = () => {
                this.stopNode(clipId);
                audioLogger.debug('Audio clip ended', { clipId });
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.error('Failed to play clip', err, { clipId, offset });
            throw AudioError.playbackFailed(clipId, err.message);
        }
    }

    /**
     * Stop a specific audio node
     */
    stopNode(clipId: string): void {
        const node = this.activeNodes.get(clipId);

        if (node) {
            try {
                node.source.stop();
            } catch (e) {
                // Already stopped - not an error
                audioLogger.debug('Node already stopped', { clipId });
            }

            try {
                node.source.disconnect();
                node.gain.disconnect();
            } catch (e) {
                audioLogger.debug('Node already disconnected', { clipId });
            }

            this.activeNodes.delete(clipId);
            audioLogger.debug('Node stopped and cleaned up', { clipId });
        }
    }

    /**
     * Stop all playing audio
     */
    stopAll(): void {
        audioLogger.debug('Stopping all audio nodes', {
            activeCount: this.activeNodes.size,
        });

        this.activeNodes.forEach((node, clipId) => {
            this.stopNode(clipId);
        });

        audioLogger.info('All audio stopped');
    }

    /**
     * Update volume for a playing clip
     */
    updateVolume(clipId: string, volume: number): void {
        const node = this.activeNodes.get(clipId);

        if (node) {
            node.gain.gain.value = volume;
            audioLogger.debug('Volume updated', { clipId, volume });
        } else {
            audioLogger.warn('Cannot update volume: clip not found', { clipId });
        }
    }

    /**
     * Start microphone recording
     */
    async startRecording(): Promise<void> {
        audioLogger.info('Starting audio recording');

        try {
            if (this.recordingState) {
                audioLogger.warn('Recording already in progress');
                return;
            }

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            audioLogger.debug('Microphone access granted', {
                tracks: stream.getTracks().length,
            });

            // Determine supported MIME type
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
                audioLogger.debug('Falling back to audio/mp4 format');
            }

            // Create MediaRecorder
            const recorder = new MediaRecorder(stream, { mimeType });

            const chunks: Blob[] = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                    audioLogger.debug('Recording data chunk received', {
                        size: event.data.size,
                    });
                }
            };

            recorder.onerror = (event) => {
                const error = (event as any).error || new Error('Recording error');
                audioLogger.error('MediaRecorder error', error);
                throw AudioError.recordingFailed(error.message);
            };

            // Start recording
            recorder.start(100); // Capture in 100ms chunks

            this.recordingState = {
                recorder,
                stream,
                chunks,
                startTime: Date.now(),
            };

            audioLogger.info('Recording started successfully', { mimeType });
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                audioLogger.error('Microphone access denied', err);
                throw AudioError.microphoneAccessDenied('User denied permission');
            }

            audioLogger.error('Failed to start recording', err);
            throw AudioError.recordingFailed(err.message, { errorName: err.name });
        }
    }

    /**
     * Stop recording and return audio blob
     */
    async stopRecording(): Promise<Blob> {
        audioLogger.info('Stopping audio recording');

        return new Promise((resolve, reject) => {
            if (!this.recordingState) {
                const error = new Error('No active recording');
                audioLogger.error('Cannot stop recording', error);
                reject(AudioError.recordingFailed('No active recording'));
                return;
            }

            const { recorder, stream, chunks, startTime } = this.recordingState;

            recorder.onstop = () => {
                const duration = Date.now() - startTime;
                const blob = new Blob(chunks, { type: recorder.mimeType });

                // Stop all tracks
                stream.getTracks().forEach(track => {
                    track.stop();
                    audioLogger.debug('Track stopped', { kind: track.kind });
                });

                this.recordingState = null;

                audioLogger.info('Recording stopped successfully', {
                    duration: `${duration}ms`,
                    blobSize: blob.size,
                    mimeType: blob.type,
                });

                resolve(blob);
            };

            recorder.stop();
        });
    }

    /**
     * Check if currently recording
     */
    isRecording(): boolean {
        return this.recordingState !== null && this.recordingState.recorder.state === 'recording';
    }

    /**
     * Get audio duration from blob
     */
    async getAudioDuration(blob: Blob): Promise<number> {
        audioLogger.debug('Getting audio duration from blob');

        try {
            const buffer = await this.loadAudioFromBlob(blob);
            audioLogger.debug('Audio duration calculated', {
                duration: buffer.duration,
            });
            return buffer.duration;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.error('Failed to get audio duration', err);
            throw error;
        }
    }

    /**
     * Generate waveform peaks for visualization
     */
    async generateWaveformPeaks(blob: Blob, numPeaks: number = 100): Promise<number[]> {
        audioLogger.debug('Generating waveform peaks', { numPeaks });

        try {
            const buffer = await this.loadAudioFromBlob(blob);
            const rawData = buffer.getChannelData(0); // Use first channel
            const blockSize = Math.floor(rawData.length / numPeaks);
            const peaks: number[] = [];

            for (let i = 0; i < numPeaks; i++) {
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

            audioLogger.debug('Waveform peaks generated', {
                numPeaks: peaks.length,
                maxPeak: Math.max(...peaks),
            });

            return peaks;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.error('Failed to generate waveform', err);
            throw error;
        }
    }

    /**
     * Mix multiple audio clips (for export)
     */
    async mixClips(
        clips: Array<{ buffer: AudioBuffer; start: number; gain: number }>
    ): Promise<AudioBuffer> {
        audioLogger.info('Mixing audio clips', { clipCount: clips.length });

        try {
            if (!this.ctx) {
                this.init();
            }

            if (clips.length === 0) {
                throw new Error('No clips to mix');
            }

            // Calculate total duration
            const totalDuration = Math.max(...clips.map(c => c.start + c.buffer.duration));
            const sampleRate = this.ctx!.sampleRate;
            const totalSamples = Math.ceil(totalDuration * sampleRate);

            audioLogger.debug('Creating offline context for mixing', {
                duration: totalDuration,
                sampleRate,
                totalSamples,
            });

            // Create offline context for rendering
            const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

            // Add all clips to the mix
            clips.forEach((clip, index) => {
                const source = offlineCtx.createBufferSource();
                source.buffer = clip.buffer;

                const gainNode = offlineCtx.createGain();
                gainNode.gain.value = clip.gain;

                source.connect(gainNode);
                gainNode.connect(offlineCtx.destination);

                source.start(clip.start);

                audioLogger.debug('Clip added to mix', {
                    index,
                    start: clip.start,
                    duration: clip.buffer.duration,
                    gain: clip.gain,
                });
            });

            // Render the mixed audio
            const renderedBuffer = await offlineCtx.startRendering();

            audioLogger.info('Audio mixing completed', {
                duration: renderedBuffer.duration,
                channels: renderedBuffer.numberOfChannels,
            });

            return renderedBuffer;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            audioLogger.error('Failed to mix clips', err, {
                clipCount: clips.length,
            });
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        audioLogger.info('Disposing audio engine');

        this.stopAll();

        if (this.ctx) {
            this.ctx.close().catch(err => {
                audioLogger.error('Error closing audio context', err);
            });
            this.ctx = null;
        }

        this.audioBufferCache.clear();

        audioLogger.info('Audio engine disposed');
    }
}

// Singleton instance
export const audioManager = new AudioEngine();
