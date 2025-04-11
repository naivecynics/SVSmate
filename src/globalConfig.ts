import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export const globalConfig = {
    // The config file paths
    ConfigFilePath: {
        BlackboardSaveFolder: '~/.svsmate/blackboard/',
        BlackboardFolderMapping: '~/.svsmate/blackboard/folderMapping.json'
    }
};