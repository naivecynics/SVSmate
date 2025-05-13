import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { outputChannel } from '../../utils/OutputChannel';
import { extractTextFromPdfRange } from '../../utils/pdfUtils';
import { getWorkspaceDir } from '../../utils/pathManager';

/**
 * Response from the AI code generation service
 */
interface AICodeResponse {
  code: string;       // The generated code snippet
  language: string;   // Programming language (e.g., "typescript", "python", "java")
  filename: string;   // Suggested filename with extension
  description: string; // Brief description of what the code does
}

/**
 * Sends PDF text content to an AI service and gets back generated code
 * Note: This is a placeholder function. The actual implementation would connect to an AI API.
 */
async function generateCodeFromText(text: string): Promise<AICodeResponse> {
  // This is where you would integrate with your AI service
  // For now, we'll simulate a response
  
  outputChannel.info('PDF Code Generator', `Processing ${text.length} characters of text`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // This is a placeholder response
  // In a real implementation, this would come from an AI service
  const mockResponse: AICodeResponse = {
    language: "typescript",
    filename: "example.ts",
    code: `// Generated from PDF content
import * as fs from 'fs';

/**
 * Example function generated from PDF content
 */
export function processData(input: string): string {
  return input.toUpperCase();
}

// Main function that demonstrates usage
export function main() {
  const data = fs.readFileSync('input.txt', 'utf-8');
  const result = processData(data);
  console.log(result);
  return result;
}`,
    description: "A TypeScript module that processes text data from a file"
  };
  
  return mockResponse;
}

/**
 * Creates a file with the generated code in the workspace
 */
async function createCodeFile(response: AICodeResponse): Promise<string> {
  try {
    // Get workspace directory
    const workspaceDir = getWorkspaceDir();
    
    // Create a directory for generated code if it doesn't exist
    const generatedCodeDir = path.join(workspaceDir, 'generated-code');
    if (!fs.existsSync(generatedCodeDir)) {
      fs.mkdirSync(generatedCodeDir, { recursive: true });
    }
    
    // Create the file path
    const filePath = path.join(generatedCodeDir, response.filename);
    
    // Write the code to the file
    fs.writeFileSync(filePath, response.code);
    
    outputChannel.info('PDF Code Generator', `Created file: ${filePath}`);
    
    return filePath;
  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error creating code file: ${error}`);
    throw error;
  }
}

/**
 * Main function that handles the entire PDF to code process
 */
export async function processPdfToCode(pdfPath: string, startPage: number, endPage: number): Promise<string> {
  try {
    // 1. Extract text from PDF
    outputChannel.info('PDF Code Generator', `Extracting text from PDF pages ${startPage+1}-${endPage+1}`);
    const pdfText = await extractTextFromPdfRange(pdfPath, startPage, endPage);
    // vscode show pdf text
    vscode.window.showInformationMessage(`Extracted text from PDF: ${pdfText.substring(0, 100)}...`);
    const aiResponse = await generateCodeFromText(pdfText);
    
    // 3. Create the code file
    const filePath = await createCodeFile(aiResponse);
    
    // 4. Show success message
    vscode.window.showInformationMessage(
      `Successfully generated ${aiResponse.language} code from PDF: ${aiResponse.description}`,
      'Open File'
    ).then(selection => {
      if (selection === 'Open File') {
        vscode.workspace.openTextDocument(filePath).then(doc => {
          vscode.window.showTextDocument(doc);
        });
      }
    });
    
    return filePath;
  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error in PDF code generation process: ${error}`);
    vscode.window.showErrorMessage(`Error generating code from PDF: ${error}`);
    throw error;
  }
}

/**
 * Command handler for the PDF code generation feature
 * This function prompts the user for a PDF file path and page range,
 * then generates code based on the PDF content
 */
export async function generateCodeFromPdf(): Promise<void> {
  try {
    // 1. Prompt user to select a PDF file
    const pdfUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'PDF Files': ['pdf'] },
      title: 'Select a PDF File for Code Generation'
    });
    
    if (!pdfUris || pdfUris.length === 0) {
      return; // User cancelled
    }
    
    const pdfPath = pdfUris[0].fsPath;
    
    // Get PDF information to validate page numbers
    const pdfBytes = fs.readFileSync(pdfPath);
    const PDFDocument = (await import('pdf-lib')).PDFDocument;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    // 2. Prompt for start page with validation
    const startPageInput = await vscode.window.showInputBox({
      prompt: `Enter start page number (0-${pageCount-1})`,
      placeHolder: '0',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 0 || num >= pageCount) {
          return `Please enter a valid page number between 0 and ${pageCount-1}`;
        }
        return null;
      }
    });
    
    if (startPageInput === undefined) {
      return; // User cancelled
    }
    
    // 3. Prompt for end page with validation
    const startPage = parseInt(startPageInput);
    const endPageInput = await vscode.window.showInputBox({
      prompt: `Enter end page number (${startPage}-${pageCount-1})`,
      placeHolder: `${Math.min(startPage + 5, pageCount-1)}`,
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < startPage || num >= pageCount) {
          return `Please enter a valid page number between ${startPage} and ${pageCount-1}`;
        }
        return null;
      }
    });
    
    if (endPageInput === undefined) {
      return; // User cancelled
    }
    
    // 4. Parse page numbers
    const endPage = parseInt(endPageInput);
    
    // 5. Show progress indicator
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Code from PDF',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Extracting text from PDF...' });
      
      // Process the PDF and generate code
      await processPdfToCode(pdfPath, startPage, endPage);
      
      return true;
    });
    
  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error in command: ${error}`);
    vscode.window.showErrorMessage(`Error generating code: ${error}`);
  }
}