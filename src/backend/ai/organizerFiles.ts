import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ChatBot } from './ChatBot';

const execAsync = promisify(exec);

export async function organizeFiles(rootPath: string, targetFiles: string[]): Promise<Record<string, string>> {
  const command = `find "${rootPath}" -type d -maxdepth 2`;
  let folderStructure = '';
  try {
    const { stdout } = await execAsync(command);
    folderStructure = stdout.trim();
  } catch (err) {
    console.error('Error fetching folder structure:', err);
    throw new Error('Failed to retrieve folder structure.');
  }

  const userPrompt = `
I have the following folder structure:

${folderStructure}

I also have these files:

${targetFiles.join('\n')}

For each file, please suggest the most appropriate folder to place it in from the above list.
Return your result as a JSON object like:
\`\`\`json
{"file1.ext": "folder1", "file2.ext": "folder2"}
\`\`\`
Only respond with the JSON object.
`;

  console.log("Raw AI Prompt:", userPrompt);

  const chatBot = new ChatBot();
  const resultText = await vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: "Asking AI to organize file...",
    cancellable: false
  }, async (progress) => {
    return await chatBot.sendMessage(userPrompt, "You are a file organization assistant.");
  });
  console.log("Raw AI Response:", resultText);

  try {
    const result = parseAIJsonResponse(resultText);
    return result;
  } catch (e) {
    console.error('Failed to parse AI response as JSON:', resultText);
    throw new Error('Invalid AI response format.');
  }
}

export function parseAIJsonResponse(raw: string): Record<string, string> {
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
