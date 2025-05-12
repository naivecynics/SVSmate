import * as fs from 'fs';
import * as path from 'path';
import { outputChannel } from '../../utils/OutputChannel';

export class SharedFileManager {
    private sharedFiles: Map<string, string> = new Map(); // Map<localPath, remotePath>

    addFile(localPath: string, remotePath: string) {
        if (!this.sharedFiles.has(localPath)) {
            this.sharedFiles.set(localPath, remotePath);
            outputChannel.info('SharedFileManager', `Added shared file: Local - ${localPath}, Remote - ${remotePath}`);
        }
    }

    removeFile(localPath: string) {
        if (this.sharedFiles.has(localPath)) {
            this.sharedFiles.delete(localPath);
            outputChannel.info('SharedFileManager', `Removed shared file: ${localPath}`);
        }
    }

    getLocalPath(remotePath: string): string | undefined {
        for (const [localPath, remote] of this.sharedFiles.entries()) {
            if (remote === remotePath) {
                return localPath;
            }
        }
        return undefined;
    }

    getRemotePath(localPath: string): string | undefined {
        return this.sharedFiles.get(localPath);
    }

    getAllLocalPaths(): string[] {
        return Array.from(this.sharedFiles.keys());
    }

    clearAllFiles() {
        for (const localPath of this.sharedFiles.keys()) {
            try {
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                    outputChannel.info('SharedFileManager', `Deleted local file: ${localPath}`);
                }
            } catch (error) {
                outputChannel.error('SharedFileManager', `Error deleting file: ${localPath}, Error: ${error}`);
            }
        }
        this.sharedFiles.clear();
        outputChannel.info('SharedFileManager', 'Cleared all shared files.');
    }
}