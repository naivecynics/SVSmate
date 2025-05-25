import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceDir } from '../../utils/pathManager';
import { AICodeResponse, generateCodeFromText } from '../ai/pdfCodeGenerator';
import { outputChannel } from '../../utils/OutputChannel';

/**
 * Extracts text from a specific page range of a PDF file
 * @param pdfPath Path to the PDF file
 * @param startPage Start page index (0-based)
 * @param endPage End page index (0-based), inclusive
 * @returns Extracted text from the specified page range
 */
export async function extractTextFromPDFRange(pdfPath: string, startPage: number, endPage: number): Promise<string> {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    const dataBuffer = fs.readFileSync(pdfPath);

    const renderOptions = {
      pagerender: async (pageData: any) => {
        const pageNum = pageData.pageNumber;
        if (pageNum >= startPage + 1 && pageNum <= endPage + 1) {
          return pageData.getTextContent().then((textContent: any) => {
            const text = textContent.items.map((item: any) => item.str).join(' ');
            return `--- Page ${pageNum} ---\n${text}\n\n`;
          });
        }
        return '';
      }
    };

    const pdfParse = await import('pdf-parse').then(m => m.default || m);
    const data = await pdfParse(dataBuffer, renderOptions);

    if (!data.text.trim()) {
      return `No content found in pages ${startPage + 1} to ${endPage + 1}`;
    }

    return data.text;
  } catch (error) {
    outputChannel.error('PDF Utils', `Error extracting PDF text: ${error}`);
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
    outputChannel.info('PDF Code Generator', `Extracting text from PDF pages ${startPage + 1}-${endPage + 1}`);
    const pdfText = await extractTextFromPDFRange(pdfPath, startPage, endPage);

    vscode.window.showInformationMessage(`Extracted text from PDF: ${pdfText.substring(0, 100)}...`);

    const aiResponse = await generateCodeFromText(pdfText, preferredLanguage);
    const filePath = await createCodeFile(aiResponse);

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
 * Creates a file with the generated code inside the current workspace directory.
 *
 * This function:
 * - Retrieves the workspace directory (via `getWorkspaceDir`)
 * - Constructs the full file path using the provided filename
 * - Writes the generated code content to the file
 * - Logs the success or failure to the output channel
 *
 * @param response - The response object containing code, filename, and related metadata
 * @returns The full file path where the code was saved
 * @throws If writing to the file fails or the workspace directory is invalid
 */
export async function createCodeFile(response: AICodeResponse): Promise<string> {
  try {
    const generatedCodeDir = getWorkspaceDir();
    const filePath = path.join(generatedCodeDir, response.filename);
    fs.writeFileSync(filePath, response.code);
    outputChannel.info('PDF Code Generator', `Created file: ${filePath}`);
    return filePath;
  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error creating code file: ${error}`);
    throw error;
  }
}
