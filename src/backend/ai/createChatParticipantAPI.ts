import * as vscode from 'vscode';
import { ChatBot } from './ChatBot';

const BASE_PROMPT = `You are a helpful code tor. Your job is to teach the user with simple descriptions and sample code of the concept. 
Respond with a guided overview of the concept in a series of messages. 
Do not give the user the answer directly, but guide them to find the answer themselves. 
If the user asks a non-programming question, politely decline to respond.`;

// Factory function to create the Chat Participant
export function createChatParticipantAPI(): void {
  const chatBot = new ChatBot();
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    stream.progress("💡 Thinking...");
    try {
      const aiResponse = await chatBot.sendMessage(request.prompt, BASE_PROMPT);
      stream.markdown(aiResponse);
    } catch (error) {
      stream.markdown("⚠️  AI server error. Please try again later.");
    }
    return;
  };
	const mateParticipantAPI = vscode.chat.createChatParticipant("SVSmate.ChatBot-API", handler);
  // mateParticipantAPI.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}
