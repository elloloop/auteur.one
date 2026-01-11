/**
 * Input Validation Utilities
 *
 * Design Principles:
 * - Single Responsibility: Each validator has one specific purpose
 * - Interface Segregation: Validators can be used independently
 * - Dependency Inversion: Validators depend on abstractions (types)
 *
 * Purpose: Prevent invalid data from entering the system, fail fast
 */

import { Clip, Track, Speaker, Take } from './types';
import { ValidationError } from './errors';
import { logger, LogCategory } from './logger';

/**
 * Validate clip data before creation/update
 */
export function validateClip(clip: Partial<Clip>, operation: 'create' | 'update'): void {
    logger.debug(LogCategory.STATE, 'validateClip', `Validating clip for ${operation}`, { clipId: clip.id });

    if (operation === 'create') {
        if (!clip.id) throw ValidationError.missingRequiredField('id');
        if (!clip.trackId) throw ValidationError.missingRequiredField('trackId');
        if (!clip.type) throw ValidationError.missingRequiredField('type');
        if (!clip.name) throw ValidationError.missingRequiredField('name');
    }

    // Validate numeric ranges
    if (clip.start !== undefined) {
        if (clip.start < 0) {
            throw ValidationError.outOfBounds(clip.start, 0, Infinity, 'start');
        }
        if (!Number.isFinite(clip.start)) {
            throw ValidationError.invalidInput('start', clip.start, 'must be a finite number');
        }
    }

    if (clip.duration !== undefined) {
        if (clip.duration <= 0) {
            throw ValidationError.outOfBounds(clip.duration, 0.001, Infinity, 'duration');
        }
        if (!Number.isFinite(clip.duration)) {
            throw ValidationError.invalidInput('duration', clip.duration, 'must be a finite number');
        }
    }

    // Validate clip type
    if (clip.type) {
        const validTypes = ['video', 'audio', 'picture', 'dialogue', 'text'];
        if (!validTypes.includes(clip.type)) {
            throw ValidationError.invalidInput('type', clip.type, `must be one of: ${validTypes.join(', ')}`);
        }
    }

    // Validate params if present
    if (clip.params) {
        validateClipParams(clip.params);
    }

    logger.debug(LogCategory.STATE, 'validateClip', 'Clip validation passed', { clipId: clip.id });
}

/**
 * Validate clip parameters
 */
function validateClipParams(params: any): void {
    if (params.volume !== undefined) {
        if (params.volume < 0 || params.volume > 2) {
            throw ValidationError.outOfBounds(params.volume, 0, 2, 'volume');
        }
    }

    if (params.opacity !== undefined) {
        if (params.opacity < 0 || params.opacity > 1) {
            throw ValidationError.outOfBounds(params.opacity, 0, 1, 'opacity');
        }
    }

    if (params.speed !== undefined) {
        if (params.speed <= 0 || params.speed > 4) {
            throw ValidationError.outOfBounds(params.speed, 0.001, 4, 'speed');
        }
    }

    if (params.transform) {
        const { x, y, rotation, scaleX, scaleY } = params.transform;

        if (x !== undefined && !Number.isFinite(x)) {
            throw ValidationError.invalidInput('transform.x', x, 'must be a finite number');
        }
        if (y !== undefined && !Number.isFinite(y)) {
            throw ValidationError.invalidInput('transform.y', y, 'must be a finite number');
        }
        if (rotation !== undefined && !Number.isFinite(rotation)) {
            throw ValidationError.invalidInput('transform.rotation', rotation, 'must be a finite number');
        }
        if (scaleX !== undefined && (scaleX <= 0 || !Number.isFinite(scaleX))) {
            throw ValidationError.invalidInput('transform.scaleX', scaleX, 'must be a positive finite number');
        }
        if (scaleY !== undefined && (scaleY <= 0 || !Number.isFinite(scaleY))) {
            throw ValidationError.invalidInput('transform.scaleY', scaleY, 'must be a positive finite number');
        }
    }
}

/**
 * Validate track data
 */
export function validateTrack(track: Partial<Track>, operation: 'create' | 'update'): void {
    logger.debug(LogCategory.STATE, 'validateTrack', `Validating track for ${operation}`, { trackId: track.id });

    if (operation === 'create') {
        if (!track.id) throw ValidationError.missingRequiredField('id');
        if (!track.name) throw ValidationError.missingRequiredField('name');
        if (!track.type) throw ValidationError.missingRequiredField('type');
        if (track.order === undefined) throw ValidationError.missingRequiredField('order');
    }

    if (track.type) {
        const validTypes = ['video', 'audio', 'picture', 'dialogue', 'text'];
        if (!validTypes.includes(track.type)) {
            throw ValidationError.invalidInput('type', track.type, `must be one of: ${validTypes.join(', ')}`);
        }
    }

    if (track.order !== undefined) {
        if (track.order < 0 || !Number.isInteger(track.order)) {
            throw ValidationError.invalidInput('order', track.order, 'must be a non-negative integer');
        }
    }

    if (track.volume !== undefined) {
        if (track.volume < 0 || track.volume > 2) {
            throw ValidationError.outOfBounds(track.volume, 0, 2, 'volume');
        }
    }

    logger.debug(LogCategory.STATE, 'validateTrack', 'Track validation passed', { trackId: track.id });
}

/**
 * Validate speaker data
 */
export function validateSpeaker(speaker: Partial<Speaker>, operation: 'create' | 'update'): void {
    logger.debug(LogCategory.STATE, 'validateSpeaker', `Validating speaker for ${operation}`, { speakerId: speaker.id });

    if (operation === 'create') {
        if (!speaker.id) throw ValidationError.missingRequiredField('id');
        if (!speaker.name) throw ValidationError.missingRequiredField('name');
    }

    if (speaker.name !== undefined) {
        if (speaker.name.trim().length === 0) {
            throw ValidationError.invalidInput('name', speaker.name, 'must not be empty');
        }
        if (speaker.name.length > 100) {
            throw ValidationError.invalidInput('name', speaker.name, 'must be 100 characters or less');
        }
    }

    if (speaker.color !== undefined) {
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorRegex.test(speaker.color)) {
            throw ValidationError.invalidInput('color', speaker.color, 'must be a valid hex color (e.g., #FF0000)');
        }
    }

    if (speaker.voiceProfile) {
        const { pitch, rate, volume } = speaker.voiceProfile;

        if (pitch !== undefined && (pitch < -1 || pitch > 1)) {
            throw ValidationError.outOfBounds(pitch, -1, 1, 'voiceProfile.pitch');
        }
        if (rate !== undefined && (rate <= 0 || rate > 4)) {
            throw ValidationError.outOfBounds(rate, 0.001, 4, 'voiceProfile.rate');
        }
        if (volume !== undefined && (volume < 0 || volume > 2)) {
            throw ValidationError.outOfBounds(volume, 0, 2, 'voiceProfile.volume');
        }
    }

    logger.debug(LogCategory.STATE, 'validateSpeaker', 'Speaker validation passed', { speakerId: speaker.id });
}

/**
 * Validate take data
 */
export function validateTake(take: Partial<Take>, operation: 'create' | 'update'): void {
    logger.debug(LogCategory.STATE, 'validateTake', `Validating take for ${operation}`, { takeId: take.id });

    if (operation === 'create') {
        if (!take.id) throw ValidationError.missingRequiredField('id');
        if (!take.source) throw ValidationError.missingRequiredField('source');
        if (take.duration === undefined) throw ValidationError.missingRequiredField('duration');
    }

    if (take.source) {
        const validSources = ['recording', 'upload', 'tts', 'import'];
        if (!validSources.includes(take.source)) {
            throw ValidationError.invalidInput('source', take.source, `must be one of: ${validSources.join(', ')}`);
        }
    }

    if (take.duration !== undefined) {
        if (take.duration <= 0) {
            throw ValidationError.outOfBounds(take.duration, 0.001, Infinity, 'duration');
        }
    }

    if (take.source === 'recording' || take.source === 'upload') {
        if (!take.blob && !take.uri) {
            throw ValidationError.missingRequiredField('blob or uri');
        }
    }

    logger.debug(LogCategory.STATE, 'validateTake', 'Take validation passed', { takeId: take.id });
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, allowedTypes: string[], maxSizeMB: number): void {
    logger.debug(LogCategory.FILESYSTEM, 'validateFile', 'Validating file', {
        filename: file.name,
        type: file.type,
        size: file.size,
    });

    // Check file type
    const fileType = file.type.split('/')[0]; // e.g., "audio", "video", "image"
    if (!allowedTypes.includes(fileType) && !allowedTypes.includes(file.type)) {
        throw ValidationError.invalidInput('file type', file.type, `must be one of: ${allowedTypes.join(', ')}`);
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        throw ValidationError.invalidInput('file size', `${(file.size / 1024 / 1024).toFixed(2)}MB`, `must be less than ${maxSizeMB}MB`);
    }

    // Check file name
    if (file.name.length > 255) {
        throw ValidationError.invalidInput('filename', file.name, 'must be 255 characters or less');
    }

    logger.debug(LogCategory.FILESYSTEM, 'validateFile', 'File validation passed', { filename: file.name });
}

/**
 * Validate clip overlap on a track
 */
export function checkClipOverlap(
    clip: Clip,
    newStart: number,
    newDuration: number,
    allClips: Clip[],
    tracks: Track[]
): boolean {
    logger.debug(LogCategory.STATE, 'checkClipOverlap', 'Checking for clip overlap', {
        clipId: clip.id,
        trackId: clip.trackId,
        newStart,
        newDuration,
    });

    const track = tracks.find(t => t.id === clip.trackId);

    // If track doesn't exist or allows overlaps, no validation needed
    if (!track || !track.rules || track.rules.overlap_policy === 'allow') {
        logger.debug(LogCategory.STATE, 'checkClipOverlap', 'Track allows overlaps', { trackId: clip.trackId });
        return false;
    }

    const newEnd = newStart + newDuration;
    const trackClips = allClips.filter(c => c.trackId === clip.trackId && c.id !== clip.id);

    for (const otherClip of trackClips) {
        const otherEnd = otherClip.start + otherClip.duration;

        // Check if clips overlap
        if (!(newEnd <= otherClip.start || newStart >= otherEnd)) {
            logger.warn(LogCategory.STATE, 'checkClipOverlap', 'Clip overlap detected', {
                clipId: clip.id,
                overlapsWithClipId: otherClip.id,
                newStart,
                newEnd,
                otherStart: otherClip.start,
                otherEnd,
            });
            return true; // Overlap detected
        }
    }

    logger.debug(LogCategory.STATE, 'checkClipOverlap', 'No overlap detected', { clipId: clip.id });
    return false;
}

/**
 * Sanitize user input strings
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
        throw ValidationError.invalidInput('input', input, 'must be a string');
    }

    // Trim whitespace
    let sanitized = input.trim();

    // Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // Remove potentially harmful characters (basic XSS prevention)
    sanitized = sanitized
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, ''); // Remove event handlers

    return sanitized;
}

/**
 * Validate duration for export
 */
export function validateExportDuration(duration: number): void {
    const MIN_DURATION = 0.1; // 100ms
    const MAX_DURATION = 3600; // 1 hour

    if (duration < MIN_DURATION) {
        throw ValidationError.outOfBounds(duration, MIN_DURATION, MAX_DURATION, 'duration');
    }

    if (duration > MAX_DURATION) {
        throw ValidationError.invalidInput('duration', duration, `exports longer than ${MAX_DURATION}s (1 hour) are not supported`);
    }
}

/**
 * Validate FPS for export
 */
export function validateFPS(fps: number): void {
    const validFPS = [24, 25, 30, 50, 60];

    if (!validFPS.includes(fps)) {
        throw ValidationError.invalidInput('fps', fps, `must be one of: ${validFPS.join(', ')}`);
    }
}
