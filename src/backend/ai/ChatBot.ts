import OpenAI from "openai";
import * as vscode from 'vscode';

// ChatBot class encapsulating API requests to DeepSeek
export class ChatBot {
  private openai: OpenAI;

  constructor(
    baseURL: string = "https://api.deepseek.com"
  ) {
    const apiKey = vscode.workspace.getConfiguration('SVSmate').get<string>('apiKey');
    if (!apiKey) {
      vscode.window.showErrorMessage("API Key missing, please config SVSmate.apiKey");
      throw new Error("Missing API Key: SVSmate.apiKey");
    }
    this.openai = new OpenAI({ apiKey, baseURL });
  }

  async sendMessage(
    userMessage: string,
    systemPrompt: string = "You are a helpful assistant."
  ): Promise<string> {
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
      return "AI server encountered an error. Please try again later.";
    }
  }
}
