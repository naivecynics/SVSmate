import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { outputChannel } from '../../utils/OutputChannel';
import * as PathManager from '../../utils/pathManager';
const yaml = require('js-yaml');

// Define a function to listen for document changes and log them
export function listenForDocumentChanges() {
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
        const filePath = event.document.fileName;


        // Check if the file is in the workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const isInWorkspace = workspaceFolders.some(folder => filePath.startsWith(folder.uri.fsPath));
            if (!isInWorkspace) {
                return;
            }
        }

        const changes = event.contentChanges;

        // Log the changes to the output channel
        outputChannel.info('Doc Change', 'File changed: ${filePath}');
        changes.forEach(change => {
            outputChannel.info('Doc Change', 'Change: ${JSON.stringify(change)}');
        });

        // Optionally, save the changes to a log file
        const logFilePath = path.join(PathManager.getDir('debug'), 'document-changes.log');
        const logEntry = {
            timestamp: new Date().toISOString(),
            filePath,
            changes
        };
        fs.appendFileSync(logFilePath, yaml.dump(logEntry));
    });

    // Return a disposable to allow cleanup
    return documentChangeListener;
}

