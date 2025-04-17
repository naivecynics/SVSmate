import * as fs from 'fs';
import * as path from 'path';

/**
 * Replace illegal characters in a name to make it filesystem-safe.
 */
export function safe(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_');
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
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}
