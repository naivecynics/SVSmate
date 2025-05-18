import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import * as vscode from 'vscode';
import { outputChannel } from './OutputChannel';
// Import the pdf-parse library for text extraction
const pdfParse = require('pdf-parse');

/**
 * Extracts text from a specific page range of a PDF file
 * @param pdfPath Path to the PDF file
 * @param startPage Start page index (0-based)
 * @param endPage End page index (0-based), inclusive
 * @returns Extracted text from the specified page range
 */
export async function extractTextFromPdfRange(pdfPath: string, startPage: number, endPage: number): Promise<string> {
  try {
    // Validate input parameters
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Read the PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Create a custom render callback to extract text by page
    const renderOptions = {
      // Flag to extract page-by-page
      pagerender: async (pageData: any) => {
        const pageNum = pageData.pageNumber;
        // Only extract text from pages in the specified range
        if (pageNum >= startPage + 1 && pageNum <= endPage + 1) {
          return pageData.getTextContent()
            .then((textContent: any) => {
              // Combine the text items into a single string
              const text = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              return `--- Page ${pageNum} ---\n${text}\n\n`;
            });
        }
        return ''; // Skip pages outside the range
      }
    };

    // Parse the PDF with our custom renderer
    const data = await pdfParse(dataBuffer, renderOptions);
    
    // If no pages were found in the range, return a message
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
 * A simpler method to extract all text from a PDF without specifying page ranges
 * @param pdfPath Path to the PDF file
 * @returns Extracted text from the entire PDF
 */
export async function extractAllTextFromPdf(pdfPath: string): Promise<string> {
  try {
    // Validate input parameters
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Read the PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Parse the PDF using pdf-parse
    const data = await pdfParse(dataBuffer);
    
    return data.text;
  } catch (error) {
    outputChannel.error('PDF Utils', `Error extracting PDF text: ${error}`);
    throw error;
  }
}

/**
 * Extracts pages from a PDF file and saves them as a new PDF
 * @param pdfPath Path to the PDF file
 * @param outputPath Path to save the extracted pages
 * @param startPage Start page index (0-based)
 * @param endPage End page index (0-based), inclusive
 * @returns Path to the saved PDF file
 */
export async function extractPdfPages(pdfPath: string, outputPath: string, startPage: number, endPage: number): Promise<string> {
  try {
    // Read the existing PDF
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Validate page range
    const pageCount = pdfDoc.getPageCount();
    if (startPage < 0 || endPage >= pageCount || startPage > endPage) {
      throw new Error(`Invalid page range: ${startPage}-${endPage}. PDF has ${pageCount} pages (0-${pageCount-1})`);
    }
    
    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();
    
    // Copy the specified pages
    const pagesToCopy = [];
    for (let i = startPage; i <= endPage; i++) {
      pagesToCopy.push(i);
    }
    
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToCopy);
    
    // Add the copied pages to the new document
    for (const page of copiedPages) {
      newPdfDoc.addPage(page);
    }
    
    // Save the new PDF document
    const newPdfBytes = await newPdfDoc.save();
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the new PDF to the output path
    fs.writeFileSync(outputPath, newPdfBytes);
    
    return outputPath;
  } catch (error) {
    outputChannel.error('PDF Utils', `Error extracting PDF pages: ${error}`);
    throw error;
  }
}