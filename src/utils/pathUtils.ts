import * as fs from 'fs';
import * as path from 'path';

/**
 * Replace illegal characters in a name to make it filesystem-safe.
 */
export function safe(name: string): string {
    // Replace illegal characters
    let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    
    // Handle reserved names
    const reservedWords = ['CON', 'PRN', 'AUX', 'NUL', 
                          'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
                          'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedWords.includes(sanitized.toUpperCase())) {
        sanitized = '_' + sanitized;
    }
    
    // Remove leading and trailing spaces and dots
    sanitized = sanitized.replace(/^[ .]+|[ .]+$/g, '');
    
    // Ensure it is not empty
    if (!sanitized) {sanitized = '_';}
    
    // Limit length (255 is usually safe)
    return sanitized.substring(0, 255);
}

/**
 * Combines a base path with a raw name (with unsafe characters),
 * sanitizes the name, ensures the directory exists, and returns the full path.
 * 
 * @param basePath Parent path
 * @param name Raw folder name (can contain unsafe characters)
 * @returns Full sanitized path (guaranteed to exist)
 */
export function safeEnsureDir(basePath: string, name: string): string {
    const dirPath = path.join(basePath, safe(name));
    if (!fs.existsSync(dirPath)) { fs.mkdirSync(dirPath, { recursive: true }); }
    return dirPath;
}
