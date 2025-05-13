import OpenAI from "openai";
import * as vscode from 'vscode';

/**
 * The ChatBot class encapsulates the API requests to DeepSeek.
 * It interacts with the DeepSeek service via OpenAI SDK to handle chat messages and return responses.
 */
export class ChatBot {
    private openai: OpenAI;

    /**
     * Constructor that initializes the ChatBot instance.
     * 
     * @param baseURL - The base URL for the DeepSeek API, default is "https://api.deepseek.com".
     * @throws {Error} Throws an error if the API key is not found in the workspace configuration.
     */
    constructor(
        baseURL: string = "https://api.deepseek.com"
    ) {
        const apiKey = vscode.workspace.getConfiguration('svsmate').get<string>('apikey');
        if (!apiKey) {
            vscode.window.showErrorMessage("API Key missing, please configure svsmate.apikey");
            throw new Error("Missing API Key: svsmate.apikey");
        }
        this.openai = new OpenAI({ apiKey, baseURL });
    }

    /**
     * Sends a user message and receives a response from the DeepSeek API.
     * 
     * @param userMessage - The message sent by the user.
     * @param systemPrompt - The system's prompt used to adjust the context of the conversation, defaults to "You are a helpful assistant."
     * @returns The response message from DeepSeek.
     * @throws {Error} If the API request fails, a default error message will be returned.
     */
    async sendMessage(
        userMessage: string,
        systemPrompt: string = "You are a helpful assistant."
    ): Promise<string> {
        try {
            // Send request to DeepSeek and get the response
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                model: "deepseek-chat",
            });
            // Return DeepSeek's response
            return completion.choices[0].message.content || "";
        } catch (error) {
            // Catch errors and return a default error message
            console.error("Error while fetching response from DeepSeek:", error);
            return "AI server encountered an error. Please try again later.";
        }
    }
}
