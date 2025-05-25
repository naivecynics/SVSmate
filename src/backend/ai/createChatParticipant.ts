import * as vscode from 'vscode';

// Define a constant for the base prompt that sets the behavior of the assistant.
const BASE_PROMPT = `You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. 
Respond with a guided overview of the concept in a series of messages. 
Do not give the user the answer directly, but guide them to find the answer themselves. 
If the user asks a non-programming question, politely decline to respond.`;

/**
 * Creates a new chat participant that handles code-related queries.
 * This participant interacts with the user by guiding them through programming concepts.
 * @returns The created chat participant for registration in extension context
 */
export function createChatParticipant(): vscode.ChatParticipant {
  /**
   * Handles chat requests for the participant.
   * 
   * @param request - The chat request containing the user's prompt.
   * @param context - The context that provides information about the current chat history.
   * @param stream - The stream where the chat response will be sent.
   * @param token - A cancellation token to abort the request if necessary.
   * @returns A promise that resolves when the chat response is fully streamed.
   */
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    // Initialize the messages array with the base prompt to set the assistant's behavior
    const messages = [vscode.LanguageModelChatMessage.User(BASE_PROMPT)];

    // Retrieve all previous participant messages from the context's history
    const previousMessages = context.history.filter(
      h => h instanceof vscode.ChatResponseTurn
    );

    // Add the previous messages to the message array
    previousMessages.forEach(m => {
      let fullMessage = '';
      m.response.forEach(r => {
        const mdPart = r as vscode.ChatResponseMarkdownPart;
        fullMessage += mdPart.value.value;
      });
      messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
    });

    // Add the user's current message to the messages array
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

    // Send the request to the model and await the response
    const chatResponse = await request.model.sendRequest(messages, {}, token);

    // Stream the response text to the user
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
    return;
  };
  // Create the chat participant using the handler defined above
  const mateParticipant = vscode.chat.createChatParticipant("svsmate.ChatBot", handler);

  // Optional: You can set the participant's icon path here if needed
  // mateParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
  
  return mateParticipant;
}
