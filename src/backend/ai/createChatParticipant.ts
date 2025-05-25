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
 * @returns The created chat participant for registration in extension context, or undefined if setup fails.
 */
export function createChatParticipant(): vscode.ChatParticipant | undefined {
  let chatBot: ChatBot;

  try {
    chatBot = new ChatBot(); // May throw if apikey is not configured
  } catch (error) {
    console.warn('[SVSmate] ChatBot initialization failed:', error);
    vscode.window.showWarningMessage(
      'SVSmate ChatBot-API is disabled: missing API key (svsmate.apikey).'
    );
    return undefined;
  }

  /**
   * Handler for processing chat requests.
   * 
   * @param request - The chat request containing the user's message.
   * @param context - The context object providing the chat history and other related data.
   * @param stream - The stream used to send the chat response back to the user.
   * @param token - A cancellation token to allow canceling the request if needed.
   * @returns A promise that resolves when the response has been streamed back to the user.
   */
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    stream.progress("Thinking...");

    try {
      const aiResponse = await chatBot.sendMessage(request.prompt, BASE_PROMPT);
      stream.markdown(aiResponse);
    } catch (error) {
      stream.markdown("AI server error. Please try again later.");
    }
  };

  // Create the chat participant with the handler defined above
  const mateParticipantAPI = vscode.chat.createChatParticipant("svsmate.ChatBot-API", handler);

  return mateParticipantAPI;
}
