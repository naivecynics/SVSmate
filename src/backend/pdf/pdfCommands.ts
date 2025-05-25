import * as vscode from 'vscode';
import * as fs from 'fs';
import { outputChannel } from '../../utils/OutputChannel';
import { processPdfToCode } from './pdfUtils';

/**
 * Command handler for the PDF code generation feature.
 * Handles the process of generating code from PDF content by:
 * 1. Prompting user to select a PDF file
 * 2. Getting page range selection from user
 * 3. Optionally selecting target programming language
 * 4. Processing PDF content to generate code
 * 
 * @throws {Error} If there are issues reading the PDF or generating code
 * @returns Promise that resolves when code generation is complete or user cancels
 */
export async function generateCodeFromPdf(): Promise<void> {
  try {
    /**
     * Step 1: PDF File Selection
     * Shows a file picker dialog filtered to PDF files only
     */        
    const pdfUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'PDF Files': ['pdf'] },
      title: 'Select a PDF File for Code Generation'
    });

    if (!pdfUris || pdfUris.length === 0) {
      return; // User cancelled selection
    }

    const pdfPath = pdfUris[0].fsPath;

    /**
     * PDF Validation
     * Loads the PDF document to verify its validity and get page count
     */
    const pdfBytes = fs.readFileSync(pdfPath);
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    /**
     * Step 2: Page Range Selection
     * Prompts for start and end pages with validation
     */
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
    }

    const endPage = parseInt(endPageInput);

    /**
     * Step 3: Target Language Selection
     * Prompts user to select a preferred programming language
     */
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

    /**
     * Step 4: Code Generation
     * Processes the PDF and generates code based on the extracted content
     */
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Code from PDF',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Extracting text from PDF...' });

      await processPdfToCode(pdfPath, startPage - 1, endPage - 1, languagePref);

      return true;
    });

  } catch (error) {
    outputChannel.error('PDF Code Generator', `Error in command: ${error}`);
    vscode.window.showErrorMessage(`Error generating code: ${error}`);
  }
}
