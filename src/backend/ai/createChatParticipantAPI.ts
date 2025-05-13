import * as vscode from 'vscode';
import { ChatBot } from './ChatBot';

// Define a constant for the base prompt that sets the behavior of the assistant.
const BASE_PROMPT = `You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. 
Respond with a guided overview of the concept in a series of messages. 
Do not give the user the answer directly, but guide them to find the answer themselves. 
If the user asks a non-programming question, politely decline to respond.`;

/**
 * Factory function to create a new Chat Participant for the API version of the ChatBot.
 * This function initializes a `ChatBot` instance and sets up the handler to manage chat requests.
 */
export function createChatParticipantAPI(): void {
  /**
   * Handler for processing chat requests.
   * 
   * @param request - The chat request containing the user's message.
   * @param context - The context object providing the chat history and other related data.
   * @param stream - The stream used to send the chat response back to the user.
   * @param token - A cancellation token to allow canceling the request if needed.
   * @returns A promise that resolves when the response has been streamed back to the user.
   */
  const chatBot = new ChatBot();

  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    // Indicate that the AI is processing the request
    stream.progress("Thinking...");

    try {
      // Send the request to the ChatBot and get the response
      const aiResponse = await chatBot.sendMessage(request.prompt, BASE_PROMPT);

      // Stream the AI response back to the user
      stream.markdown(aiResponse);
    } catch (error) {
      // In case of an error, notify the user
      stream.markdown(" AI server error. Please try again later.");
    }

    return;
  };

  // Create the chat participant with the handler defined above
  const mateParticipantAPI = vscode.chat.createChatParticipant("svsmate.ChatBot-API", handler);

  // Optional: Set the participant's icon path here if needed
  // mateParticipantAPI.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}
