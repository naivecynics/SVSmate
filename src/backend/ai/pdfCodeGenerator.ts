import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { outputChannel } from '../../utils/OutputChannel';
import { extractTextFromPdfRange } from '../../utils/pdfUtils';
import { getWorkspaceDir } from '../../utils/pathManager';
import { ChatBot } from './ChatBot';

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
 * Uses the ChatBot class to connect to the DeepSeek API
 * 
 * @param text - The text content extracted from PDF
 * @param preferredLanguage - Optional preferred programming language
 * @returns A promise resolving to the generated code response
 */
async function generateCodeFromText(
  text: string, 
  preferredLanguage?: string
): Promise<AICodeResponse> {
  try {
    // Log the process start
    outputChannel.info('PDF Code Generator', `Processing ${text.length} characters of text`);
    if (preferredLanguage) {
      outputChannel.info('PDF Code Generator', `Preferred language: ${preferredLanguage}`);
    }

    // Create a new instance of ChatBot
    const chatbot = new ChatBot();

    // Prepare the system prompt that instructs the AI how to format its response
    const systemPrompt = `
    You are a code generation assistant. Generate code based on the PDF content provided. 
    Analyze the content and create appropriate code that implements the concepts described.
    
    Your response must be a valid JSON object with the following fields:
    {
      "language": "programming language (e.g. typescript, python, java)",
      "filename": "appropriate filename with extension",
      "code": "the complete code implementation",
      "description": "brief description of what the code does"
    }
    
    Make the code well-structured, properly commented, and following best practices.
    `;    // Prepare the user message with the PDF content
    const userMessage = `
    Generate code based on the following PDF content:
    
    ${text.substring(0, 8000)} ${text.length > 8000 ? '... (content truncated)' : ''}
    
    Analyze the content and create appropriate code that implements the concepts described.
    ${preferredLanguage ? `Please use ${preferredLanguage} as the programming language.` : ''}
    Return only the JSON response as instructed, without any additional text.
    `;

    // Send the message to the AI and get the response
    const aiResponse = await chatbot.sendMessage(userMessage, systemPrompt);

    outputChannel.info('PDF Code Generator', `AI response received: ${userMessage}`);
    outputChannel.info('PDF Code Generator', `AI response received: ${systemPrompt}`);
    outputChannel.info('PDF Code Generator', `AI response received: ${aiResponse}`);

    // Try to parse the JSON response
    let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Unable to parse valid JSON from AI response');
    }

    const responseData = JSON.parse(jsonMatch[0]);

    // Validate that all required fields are present
    if (!responseData.language || !responseData.filename || !responseData.code || !responseData.description) {
      throw new Error('AI response is missing required fields');
    }

    // Format the response
    const formattedResponse: AICodeResponse = {
      language: responseData.language,
      filename: responseData.filename,
      code: responseData.code,
      description: responseData.description
    };

    outputChannel.info('PDF Code Generator', `Successfully generated ${formattedResponse.language} code`);
    return formattedResponse;
  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error in code generation: ${error}`);

    // Return a fallback response in case of error
    return {
      language: "text",
      filename: "error.txt",
      code: `// Error generating code from PDF content\n// ${error}\n\n// PDF Content sample:\n/*\n${text.substring(0, 200)}...\n*/`,
      description: "Error occurred during code generation"
    };
  }
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
 * 
 * @param pdfPath - The path to the PDF file
 * @param startPage - The starting page number (zero-based)
 * @param endPage - The ending page number (zero-based)
 * @param preferredLanguage - Optional preferred programming language
 * @returns A promise resolving to the path of the generated code file
 */
export async function processPdfToCode(
  pdfPath: string, 
  startPage: number, 
  endPage: number,
  preferredLanguage?: string
): Promise<string> {
  try {
    // 1. Extract text from PDF
    outputChannel.info('PDF Code Generator', `Extracting text from PDF pages ${startPage + 1}-${endPage + 1}`);
    const pdfText = await extractTextFromPdfRange(pdfPath, startPage, endPage);
    // vscode show pdf text
    vscode.window.showInformationMessage(`Extracted text from PDF: ${pdfText.substring(0, 100)}...`);
    const aiResponse = await generateCodeFromText(pdfText, preferredLanguage);

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
      prompt: `Enter start page number (0-${pageCount - 1})`,
      placeHolder: '0',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 0 || num >= pageCount) {
          return `Please enter a valid page number between 0 and ${pageCount - 1}`;
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
      prompt: `Enter end page number (${startPage}-${pageCount - 1})`,
      placeHolder: `${Math.min(startPage + 5, pageCount - 1)}`,
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < startPage || num >= pageCount) {
          return `Please enter a valid page number between ${startPage} and ${pageCount - 1}`;
        }
        return null;
      }
    });

    if (endPageInput === undefined) {
      return; // User cancelled
    }    // 4. Parse page numbers
    const endPage = parseInt(endPageInput);

    // 5. Prompt for preferred programming language (optional)
    const languageOptions = ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Other'];
    const preferredLanguage = await vscode.window.showQuickPick(
      [...languageOptions, '未指定'],
      { 
        placeHolder: '选择目标编程语言 (可选)', 
        canPickMany: false,
        title: '首选编程语言'
      }
    );
    
    // If user cancelled or selected "未指定", preferredLanguage will be undefined or "未指定"
    const languagePref = preferredLanguage && preferredLanguage !== '未指定' ? preferredLanguage : undefined;

    // 6. Show progress indicator
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Code from PDF',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Extracting text from PDF...' });

      // Process the PDF and generate code with preferred language
      await processPdfToCode(pdfPath, startPage, endPage, languagePref);

      return true;
    });

  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error in command: ${error}`);
    vscode.window.showErrorMessage(`Error generating code: ${error}`);
  }
}