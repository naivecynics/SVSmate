import OpenAI from "openai";
import * as vscode from 'vscode';

// ChatBot class encapsulating API requests to DeepSeek
export class ChatBot {
  private openai: OpenAI;

  constructor(apiKey: string, baseURL: string = "https://api.deepseek.com") {
    this.openai = new OpenAI({ apiKey, baseURL });
  }

  async sendMessage(userMessage: string, systemPrompt: string = "You are a helpful assistant."): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: "deepseek-chat",
      });

      return completion.choices[0].message.content || "";
    } catch (error) {
      console.error("Error while fetching response from DeepSeek:", error);
      return "⚠️ AI server encountered an error. Please try again later.";
    }
  }
}

const BASE_PROMPT = `You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. 
Respond with a guided overview of the concept in a series of messages. 
Do not give the user the answer directly, but guide them to find the answer themselves. 
If the user asks a non-programming question, politely decline to respond.`;

// Factory function to create the Chat Participant
export function createChatParticipant(apiKey: string): vscode.ChatParticipant {
  const chatBot = new ChatBot(apiKey);

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
      stream.markdown("⚠️ AI server error. Please try again later.");
    }
    return;

  };

  return vscode.chat.createChatParticipant("SVSMate.ChatBot", handler);
}
