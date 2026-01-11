/**
 * Custom Error Classes for Auteur Video Editor
 *
 * Design Principles:
 * - Single Responsibility: Each error class represents a specific type of failure
 * - Liskov Substitution: All custom errors extend base AppError
 * - Open/Closed: Easy to add new error types without modifying existing code
 *
 * Usage: Throw specific error types to help AI agents understand failure context
 */

import { LogCategory, logger } from './logger';

/**
 * Base application error with enhanced context for debugging
 */
export class AppError extends Error {
    public readonly code: string;
    public readonly category: LogCategory;
    public readonly context: Record<string, any>;
    public readonly timestamp: string;
    public readonly recoverable: boolean;

    constructor(
        message: string,
        code: string,
        category: LogCategory,
        context: Record<string, any> = {},
        recoverable: boolean = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.category = category;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.recoverable = recoverable;

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);

        // Auto-log error
        logger.error(category, code, message, this, context);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            category: this.category,
            context: this.context,
            timestamp: this.timestamp,
            recoverable: this.recoverable,
            stack: this.stack,
        };
    }
}

/**
 * Audio-related errors (recording, playback, encoding)
 */
export class AudioError extends AppError {
    constructor(message: string, code: string, context: Record<string, any> = {}) {
        super(message, code, LogCategory.AUDIO, context);
    }

    static microphoneAccessDenied(details?: string): AudioError {
        return new AudioError(
            `Microphone access denied. ${details || 'Please allow microphone permissions in browser settings.'}`,
            'AUDIO_MIC_ACCESS_DENIED',
            { details, requiredPermission: 'microphone' }
        );
    }

    static recordingFailed(reason: string, context?: Record<string, any>): AudioError {
        return new AudioError(
            `Audio recording failed: ${reason}`,
            'AUDIO_RECORDING_FAILED',
            { reason, ...context }
        );
    }

    static playbackFailed(clipId: string, reason: string): AudioError {
        return new AudioError(
            `Audio playback failed for clip ${clipId}: ${reason}`,
            'AUDIO_PLAYBACK_FAILED',
            { clipId, reason }
        );
    }

    static decodingFailed(source: string, error: Error): AudioError {
        return new AudioError(
            `Failed to decode audio from ${source}`,
            'AUDIO_DECODING_FAILED',
            { source, originalError: error.message }
        );
    }

    static contextInitFailed(error: Error): AudioError {
        return new AudioError(
            'Failed to initialize Web Audio API context',
            'AUDIO_CONTEXT_INIT_FAILED',
            { originalError: error.message },
            false // Not recoverable
        );
    }
}

/**
 * Video/Export-related errors
 */
export class ExportError extends AppError {
    constructor(message: string, code: string, context: Record<string, any> = {}) {
        super(message, code, LogCategory.EXPORT, context);
    }

    static ffmpegNotAvailable(): ExportError {
        return new ExportError(
            'FFmpeg is not available. This may be due to server-side rendering or browser compatibility.',
            'EXPORT_FFMPEG_UNAVAILABLE',
            { environment: typeof window !== 'undefined' ? 'browser' : 'server' },
            false
        );
    }

    static ffmpegLoadFailed(error: Error): ExportError {
        return new ExportError(
            'Failed to load FFmpeg WebAssembly module',
            'EXPORT_FFMPEG_LOAD_FAILED',
            { originalError: error.message }
        );
    }

    static frameRenderingFailed(frameNumber: number, totalFrames: number, error: Error): ExportError {
        return new ExportError(
            `Failed to render frame ${frameNumber} of ${totalFrames}`,
            'EXPORT_FRAME_RENDER_FAILED',
            { frameNumber, totalFrames, progress: (frameNumber / totalFrames) * 100, originalError: error.message }
        );
    }

    static audioMixingFailed(clipCount: number, error: Error): ExportError {
        return new ExportError(
            `Failed to mix ${clipCount} audio clips`,
            'EXPORT_AUDIO_MIX_FAILED',
            { clipCount, originalError: error.message }
        );
    }

    static encodingFailed(command: string[], error: Error): ExportError {
        return new ExportError(
            'FFmpeg encoding failed',
            'EXPORT_ENCODING_FAILED',
            { command: command.join(' '), originalError: error.message }
        );
    }

    static noCanvas(): ExportError {
        return new ExportError(
            'Canvas element not available for export',
            'EXPORT_NO_CANVAS',
            {},
            false
        );
    }
}

/**
 * File system and I/O errors
 */
export class FileError extends AppError {
    constructor(message: string, code: string, context: Record<string, any> = {}) {
        super(message, code, LogCategory.FILESYSTEM, context);
    }

    static fileNotFound(filename: string, expectedPath?: string): FileError {
        return new FileError(
            `File not found: ${filename}`,
            'FILE_NOT_FOUND',
            { filename, expectedPath }
        );
    }

    static invalidFileType(filename: string, expectedTypes: string[], actualType: string): FileError {
        return new FileError(
            `Invalid file type for ${filename}. Expected: ${expectedTypes.join(', ')}, Got: ${actualType}`,
            'FILE_INVALID_TYPE',
            { filename, expectedTypes, actualType }
        );
    }

    static fileReadFailed(filename: string, error: Error): FileError {
        return new FileError(
            `Failed to read file: ${filename}`,
            'FILE_READ_FAILED',
            { filename, originalError: error.message }
        );
    }

    static fileTooLarge(filename: string, size: number, maxSize: number): FileError {
        return new FileError(
            `File ${filename} is too large (${size} bytes). Max size: ${maxSize} bytes`,
            'FILE_TOO_LARGE',
            { filename, size, maxSize }
        );
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
    constructor(message: string, code: string, context: Record<string, any> = {}) {
        super(message, code, LogCategory.STATE, context, true);
    }

    static invalidInput(field: string, value: any, constraints: string): ValidationError {
        return new ValidationError(
            `Invalid input for ${field}: ${constraints}`,
            'VALIDATION_INVALID_INPUT',
            { field, value, constraints }
        );
    }

    static clipOverlap(clipId: string, trackId: string, start: number, end: number): ValidationError {
        return new ValidationError(
            `Clip ${clipId} overlaps with existing clips on track ${trackId}`,
            'VALIDATION_CLIP_OVERLAP',
            { clipId, trackId, start, end }
        );
    }

    static missingRequiredField(field: string, context?: Record<string, any>): ValidationError {
        return new ValidationError(
            `Missing required field: ${field}`,
            'VALIDATION_MISSING_FIELD',
            { field, ...context }
        );
    }

    static outOfBounds(value: number, min: number, max: number, field?: string): ValidationError {
        return new ValidationError(
            `Value ${value} is out of bounds [${min}, ${max}]${field ? ` for field ${field}` : ''}`,
            'VALIDATION_OUT_OF_BOUNDS',
            { value, min, max, field }
        );
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends AppError {
    constructor(message: string, code: string, context: Record<string, any> = {}) {
        super(message, code, LogCategory.NETWORK, context);
    }

    static requestFailed(url: string, method: string, status?: number, statusText?: string): NetworkError {
        return new NetworkError(
            `${method} request to ${url} failed${status ? ` with status ${status}` : ''}`,
            'NETWORK_REQUEST_FAILED',
            { url, method, status, statusText }
        );
    }

    static timeout(url: string, timeoutMs: number): NetworkError {
        return new NetworkError(
            `Request to ${url} timed out after ${timeoutMs}ms`,
            'NETWORK_TIMEOUT',
            { url, timeoutMs }
        );
    }

    static offline(): NetworkError {
        return new NetworkError(
            'Network connection unavailable',
            'NETWORK_OFFLINE',
            { online: navigator.onLine }
        );
    }
}

/**
 * UI/State management errors
 */
export class StateError extends AppError {
    constructor(message: string, code: string, context: Record<string, any> = {}) {
        super(message, code, LogCategory.STATE, context);
    }

    static invalidTransition(from: string, to: string, reason?: string): StateError {
        return new StateError(
            `Invalid state transition from ${from} to ${to}${reason ? `: ${reason}` : ''}`,
            'STATE_INVALID_TRANSITION',
            { from, to, reason }
        );
    }

    static clipNotFound(clipId: string): StateError {
        return new StateError(
            `Clip not found: ${clipId}`,
            'STATE_CLIP_NOT_FOUND',
            { clipId }
        );
    }

    static trackNotFound(trackId: string): StateError {
        return new StateError(
            `Track not found: ${trackId}`,
            'STATE_TRACK_NOT_FOUND',
            { trackId }
        );
    }
}

/**
 * Error handler utility for async operations
 */
export async function handleAsyncError<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    context?: Record<string, any>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof AppError) {
            throw error; // Re-throw custom errors
        }
        // Wrap generic errors
        throw new AppError(
            `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`,
            'UNKNOWN_ERROR',
            LogCategory.STATE,
            { ...context, originalError: error },
            true
        );
    }
}

/**
 * User-friendly error message generator
 */
export function getUserFriendlyMessage(error: Error): string {
    if (error instanceof AudioError) {
        if (error.code === 'AUDIO_MIC_ACCESS_DENIED') {
            return 'Please allow microphone access to record audio. Check your browser settings.';
        }
        return 'An audio error occurred. Please check your audio settings and try again.';
    }

    if (error instanceof ExportError) {
        if (error.code === 'EXPORT_FFMPEG_UNAVAILABLE') {
            return 'Video export is not available in your current environment.';
        }
        return 'Failed to export video. Please try again or contact support if the problem persists.';
    }

    if (error instanceof FileError) {
        return `File error: ${error.message}. Please check the file and try again.`;
    }

    if (error instanceof ValidationError) {
        return error.message; // Validation errors are already user-friendly
    }

    if (error instanceof NetworkError) {
        if (error.code === 'NETWORK_OFFLINE') {
            return 'No internet connection. Please check your connection and try again.';
        }
        return 'Network error. Please check your connection and try again.';
    }

    return 'An unexpected error occurred. Please try again.';
}
