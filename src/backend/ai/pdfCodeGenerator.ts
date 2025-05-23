import { outputChannel } from '../../utils/OutputChannel';
import { ChatBot } from './ChatBot';

/**
 * Response from the AI code generation service
 */
export interface AICodeResponse {
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
export async function generateCodeFromText(
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
