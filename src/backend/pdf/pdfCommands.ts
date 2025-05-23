import * as vscode from 'vscode';
import * as fs from 'fs';
import { outputChannel } from '../../utils/OutputChannel';
import { processPdfToCode } from './pdfUtils';

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
      prompt: `Enter start page number (1-${pageCount})`,
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > pageCount) {
          return `Please enter a valid page number between 1 and ${pageCount}`;
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
      prompt: `Enter end page number (${startPage}-${pageCount})`,
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < startPage || num > pageCount) {
          return `Please enter a valid page number between ${startPage} and ${pageCount}`;
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
      [...languageOptions, 'Unspecified'],
      { 
        placeHolder: 'Please select your target language', 
        canPickMany: false,
        title: 'Target Language'
      }
    );
    
    const languagePref = preferredLanguage && preferredLanguage !== 'Unspecified' ? preferredLanguage : undefined;

    // 6. Show progress indicator
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Code from PDF',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Extracting text from PDF...' });

      // Process the PDF and generate code with preferred language
      await processPdfToCode(pdfPath, startPage - 1, endPage - 1, languagePref);

      return true;
    });

  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error in command: ${error}`);
    vscode.window.showErrorMessage(`Error generating code: ${error}`);
  }
}
