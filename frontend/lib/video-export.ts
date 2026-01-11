import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Clip, Track, Speaker } from './types';
import { audioManager } from './audio-engine';
import { EFFECTS } from './effects';

export class VideoExporter {
    private ffmpeg: FFmpeg | null = null;
    private loaded = false;

    constructor() {
        // Only initialize FFmpeg in the browser
        if (typeof window !== 'undefined') {
            this.ffmpeg = new FFmpeg();
        }
    }

    async load(onProgress?: (progress: number) => void) {
        if (this.loaded || !this.ffmpeg) return;

        this.ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
        });

        this.ffmpeg.on('progress', ({ progress }) => {
            if (onProgress) {
                onProgress(progress * 100);
            }
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        this.loaded = true;
    }

    async exportVideo(
        canvas: HTMLCanvasElement,
        clips: Clip[],
        tracks: Track[],
        speakers: Speaker[],
        duration: number,
        fps: number = 30,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        if (!this.ffmpeg) {
            throw new Error('FFmpeg not available (server-side rendering?)');
        }

        if (!this.loaded) {
            await this.load(onProgress);
        }

        const width = canvas.width;
        const height = canvas.height;
        const totalFrames = Math.ceil(duration * fps);

        // Create a temporary canvas for rendering
        const ctx = canvas.getContext('2d')!;

        // Render all frames
        const frames: Uint8Array[] = [];

        for (let i = 0; i < totalFrames; i++) {
            const time = i / fps;

            // Clear canvas
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);

            // Render each clip at this time
            for (const track of tracks) {
                if (track.mute) continue;

                const trackClips = clips
                    .filter(c => c.trackId === track.id)
                    .filter(c => time >= c.start && time < c.start + c.duration)
                    .sort((a, b) => a.start - b.start);

                for (const clip of trackClips) {
                    const localTime = time - clip.start;
                    await this.renderClip(ctx, width, height, clip, localTime, speakers);
                }
            }

            // Capture frame as raw RGBA data
            const imageData = ctx.getImageData(0, 0, width, height);
            frames.push(new Uint8Array(imageData.data.buffer));

            if (onProgress) {
                onProgress((i / totalFrames) * 50); // First 50% is rendering frames
            }
        }

        // Write frames to FFmpeg
        for (let i = 0; i < frames.length; i++) {
            await this.ffmpeg.writeFile(`frame${i.toString().padStart(5, '0')}.rgba`, frames[i]);
        }

        // Mix audio tracks
        const audioBlob = await this.mixAudioTracks(clips, tracks, duration);
        if (audioBlob) {
            await this.ffmpeg.writeFile('audio.webm', await fetchFile(audioBlob));
        }

        // Run FFmpeg to create video
        const args = [
            '-f', 'rawvideo',
            '-pixel_format', 'rgba',
            '-video_size', `${width}x${height}`,
            '-framerate', fps.toString(),
            '-i', 'frame%05d.rgba',
        ];

        if (audioBlob) {
            args.push('-i', 'audio.webm');
            args.push('-c:a', 'aac');
            args.push('-b:a', '192k');
        }

        args.push(
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            'output.mp4'
        );

        await this.ffmpeg.exec(args);

        // Read output file
        const data = await this.ffmpeg.readFile('output.mp4');
        const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data as any);

        // Clean up
        for (let i = 0; i < frames.length; i++) {
            await this.ffmpeg.deleteFile(`frame${i.toString().padStart(5, '0')}.rgba`);
        }
        if (audioBlob) {
            await this.ffmpeg.deleteFile('audio.webm');
        }
        await this.ffmpeg.deleteFile('output.mp4');

        if (onProgress) {
            onProgress(100);
        }

        return new Blob([uint8Array], { type: 'video/mp4' });
    }

    private async renderClip(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        clip: Clip,
        time: number,
        speakers: Speaker[]
    ) {
        const effect = EFFECTS[clip.type];
        if (!effect) return;

        // Apply transform
        ctx.save();
        if (clip.params.transform) {
            const t = clip.params.transform;
            ctx.translate(t.x * width, t.y * height);
            ctx.rotate((t.rotation * Math.PI) / 180);
            ctx.scale(t.scaleX, t.scaleY);
        }

        // Handle different clip types
        if (clip.type === 'video' && clip.params.videoElement) {
            // For video clips, we need the actual video element
            const video = clip.params.videoElement;
            video.currentTime = time * (clip.params.speed || 1);
            ctx.globalAlpha = clip.params.opacity || 1;
            ctx.drawImage(video, 0, 0, width, height);
        } else if (clip.type === 'picture' && clip.params.imageElement) {
            // For image clips
            const img = clip.params.imageElement;
            ctx.globalAlpha = clip.params.opacity || 1;
            ctx.drawImage(img, 0, 0, width, height);
        } else {
            // For dialogue, text, audio (waveforms), use effects
            effect.render(ctx, width, height, time, clip.params, clip);
        }

        ctx.restore();
    }

    private async mixAudioTracks(clips: Clip[], tracks: Track[], duration: number): Promise<Blob | null> {
        // Get all audio clips (dialogue and audio types)
        const audioClips = clips.filter(c =>
            (c.type === 'dialogue' || c.type === 'audio') &&
            !tracks.find(t => t.id === c.trackId)?.mute
        );

        if (audioClips.length === 0) return null;

        // Use Web Audio API to mix audio
        const offlineCtx = new OfflineAudioContext(2, duration * 48000, 48000);

        for (const clip of audioClips) {
            try {
                let audioSource: Blob | undefined;

                if (clip.type === 'dialogue') {
                    // Find active take
                    const activeTake = clip.takes?.find(t => t.id === clip.activeTakeId);
                    if (activeTake?.blob) {
                        audioSource = activeTake.blob;
                    }
                } else if (clip.type === 'audio' && clip.params.audioBlob) {
                    audioSource = clip.params.audioBlob;
                }

                if (!audioSource) continue;

                // Decode audio
                const arrayBuffer = await audioSource.arrayBuffer();
                const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

                // Create source
                const source = offlineCtx.createBufferSource();
                source.buffer = audioBuffer;

                // Apply speed
                source.playbackRate.value = clip.params.speed || 1;

                // Apply volume
                const gainNode = offlineCtx.createGain();
                const track = tracks.find(t => t.id === clip.trackId);
                const trackVolume = track?.volume ?? 1;
                gainNode.gain.value = (clip.params.volume || 1) * trackVolume;

                // Connect and schedule
                source.connect(gainNode);
                gainNode.connect(offlineCtx.destination);
                source.start(clip.start);

            } catch (error) {
                console.error('Error processing audio clip:', error);
            }
        }

        // Render offline audio
        const renderedBuffer = await offlineCtx.startRendering();

        // Convert AudioBuffer to Blob
        return this.audioBufferToBlob(renderedBuffer);
    }

    private async audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
        // Create a temporary audio context for encoding
        const ctx = new AudioContext();
        const mediaStreamDestination = ctx.createMediaStreamDestination();
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(mediaStreamDestination);

        // Use MediaRecorder to encode
        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        const chunks: Blob[] = [];

        return new Promise((resolve) => {
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                resolve(new Blob(chunks, { type: 'audio/webm' }));
                ctx.close();
            };

            mediaRecorder.start();
            source.start();

            // Stop after buffer duration
            setTimeout(() => {
                mediaRecorder.stop();
            }, audioBuffer.duration * 1000 + 100);
        });
    }

    async exportAudioStem(clips: Clip[], tracks: Track[], duration: number): Promise<Blob> {
        return (await this.mixAudioTracks(clips, tracks, duration)) || new Blob([], { type: 'audio/webm' });
    }

    async exportSubtitles(clips: Clip[], speakers: Speaker[]): Promise<string> {
        // Generate SRT subtitles from dialogue clips
        const dialogueClips = clips
            .filter(c => c.type === 'dialogue')
            .sort((a, b) => a.start - b.start);

        let srt = '';
        let index = 1;

        for (const clip of dialogueClips) {
            const speaker = speakers.find(s => s.id === clip.speaker);
            const text = clip.content || clip.scriptText || '';

            if (!text) continue;

            const startTime = this.formatSRTTime(clip.start);
            const endTime = this.formatSRTTime(clip.start + clip.duration);

            srt += `${index}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            if (speaker) {
                srt += `[${speaker.name}] ${text}\n`;
            } else {
                srt += `${text}\n`;
            }
            srt += '\n';

            index++;
        }

        return srt;
    }

    private formatSRTTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }
}

// Only create instance on client side
export const videoExporter = typeof window !== 'undefined' ? new VideoExporter() : null;
