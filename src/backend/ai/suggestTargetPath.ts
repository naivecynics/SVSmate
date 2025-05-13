import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { ChatBot } from './ChatBot';
import { BBMaterialItem } from '../../frontend/BBMaterialView';
import * as PathManager from '../../utils/pathManager';
import { outputChannel } from '../../utils/OutputChannel';

const execAsync = promisify(exec);

/**
 * Builds a prompt for the AI to suggest the most appropriate folder for a file.
 * 
 * @param folderStructure - The folder structure in the workspace.
 * @param filePath - The path to the file to be organized.
 * @returns The formatted prompt that will be sent to the AI.
 */
function buildUserPrompt(folderStructure: string, filePath: string): string {
  return `
I have the following folder structure:

${folderStructure}

I also have this file:

${filePath}

Please suggest the most appropriate folder to place this file in from the above list.
Return your result as a JSON object like:

\`\`\`json
{"${filePath}": "target-folder-path"}
\`\`\`

Only respond with the JSON object.
`;
}

/**
 * Suggests the target folder path for a given file item.
 * 
 * @param item - The BBMaterialItem that represents the file to be organized.
 * @returns A promise that resolves to the suggested folder path.
 * @throws Will throw an error if the AI response is invalid or the folder structure cannot be fetched.
 */
export async function suggestTargetPath(item: BBMaterialItem): Promise<string> {
  const bbRoot = PathManager.getDir('bb');
  const workspaceRoot = PathManager.getWorkspaceDir();
  const actualPath = item.realPath ?? item.resourceUri.fsPath;
  const relativePathFromBB = path.relative(bbRoot, actualPath);

  const command = `cd "${workspaceRoot}" && find . -type d -maxdepth 2`;
  let folderStructure = '';
  try {
    const { stdout } = await execAsync(command);
    folderStructure = stdout.trim();
  } catch (err) {
    console.error('Error fetching folder structure:', err);
    throw new Error('Failed to retrieve folder structure.');
  }

  const userPrompt = buildUserPrompt(folderStructure, relativePathFromBB);
  outputChannel.info('suggestTargetPath', `Raw AI Prompt: ${userPrompt}`);

  const chatBot = new ChatBot();
  const resultText = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: "Asking AI to suggest a folder...",
    cancellable: false
  }, async () => {
    return await chatBot.sendMessage(userPrompt, "You are a file organization assistant.");
  });

  outputChannel.info('suggestTargetPath', `Raw AI Response: ${resultText}`);

  try {
    const result = parseAIJsonResponse(resultText);
    const suggestedRelativePath = result[relativePathFromBB];

    if (!suggestedRelativePath) {
      throw new Error('AI did not return a valid suggestion for the file.');
    }

    const resolvedTarget = path.resolve(workspaceRoot, suggestedRelativePath);
    return resolvedTarget;
  } catch (err) {
    console.error('Failed to parse AI response:', resultText);
    throw new Error('AI response format is invalid or missing expected path.');
  }
}

/**
 * Parses the raw AI response into a valid JSON object.
 * 
 * @param raw - The raw AI response string.
 * @returns The parsed JSON object.
 * @throws Will throw an error if the AI response is not valid JSON.
 */
function parseAIJsonResponse(raw: string): Record<string, string> {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*|^```\s*/i, '').replace(/```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse AI JSON response:', cleaned);
    throw new Error('AI response is not valid JSON.');
  }
}
