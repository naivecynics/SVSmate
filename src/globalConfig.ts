import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

let rootPath = vscode.workspace.getConfiguration('svsmate').get('root') as string;
if (rootPath.startsWith('~')) {
    rootPath = path.join(os.homedir(), rootPath.slice(1));
}

export const globalConfig = {
    // The config file paths
    ConfigFolderPath: {
        SVSMateFolder: path.join(rootPath, '.svsmate'),
        BlackboardSaveFolder: path.join(rootPath, '.svsmate/blackboard'),
        DebugFolder: path.join(rootPath, '.svsmate/debug'),
    },
    ConfigFilePath: {
        BlackboardFolderMapping: path.join(rootPath, '.svsmate/blackboard/folderMapping.json')
    }
};