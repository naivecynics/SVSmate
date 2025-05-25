import * as assert from 'assert';
import * as pdfUtils from '../../backend/pdf/pdfUtils';

suite('pdfutils Test Suit', () => {
  // test('Sample test pipeline pass!', () => {
  //   assert.strictEqual([1, 2, 3].indexOf(5), -1);
  //   assert.strictEqual([1, 2, 3].indexOf(0), -1);
  // });
  
  test('Extract text from PDF pages', async () => { 

  const pdfPath = 'test.pdf'; // Path to your test PDF file
  const startPage = 0; // Start from the first page (0-indexed)
  const endPage = 1; // Extract only the first page
    
  });

  test('Creat cide file from AI response', async () => {
    const aiResponse = { 

      text: "Sample response text",
      metadata: {
        source: "AI Model",
        confidence: 0.95
      }
    };

  });

});

