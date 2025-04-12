import * as vscode from 'vscode';

const BASE_PROMPT = `You are a helpful code tor. Your job is to teach the user with simple descriptions and sample code of the concept. 
Respond with a guided overview of the concept in a series of messages. 
Do not give the user the answer directly, but guide them to find the answer themselves. 
If the user asks a non-programming question, politely decline to respond.`;

export function createChatParticipant(): void {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    // initialize the messages array with the prompt
    const messages = [vscode.LanguageModelChatMessage.User(BASE_PROMPT)];
    // get all the previous participant messages
    const previousMessages = context.history.filter(
      h => h instanceof vscode.ChatResponseTurn
    );
    // add the previous messages to the messages array
    previousMessages.forEach(m => {
      let fullMessage = '';
      m.response.forEach(r => {
        const mdPart = r as vscode.ChatResponseMarkdownPart;
        fullMessage += mdPart.value.value;
      });
      messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
    });
    // add in the user's message
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
    // send the request
    const chatResponse = await request.model.sendRequest(messages, {}, token);
    // stream the response
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
    return;
  };
	const mateParticipant = vscode.chat.createChatParticipant("SVSmate.ChatBot", handler);
  // mateParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'tutor.jpeg');
}
