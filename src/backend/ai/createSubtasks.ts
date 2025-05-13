import { ChatBot } from './ChatBot';
import { TodoListViewProvider, TodoItem } from "../../frontend/TodoListView";
import * as vscode from "vscode";

/**
 * Uses AI to break a parent task into subtasks.
 * 
 * @param parentTask - The main task to be broken down into smaller, manageable tasks.
 * @param numberOfSubtasks - The maximum number of subtasks to generate (defaults to 5).
 * @returns A promise that resolves to an array of generated subtasks.
 * @throws Will throw an error if the AI response does not contain valid JSON or if the format is incorrect.
 */
export async function createSubtasksWithAI(
  parentTask: TodoItem,
  numberOfSubtasks: number = 5
): Promise<TodoItem[]> {
  try {
    const chatbot = new ChatBot();
    const userMessage = `
      Please break down the following task into ${numberOfSubtasks} or fewer specific subtasks.
      Each subtask should be clear and actionable.

      Main task: ${parentTask.label}
      Task description: ${parentTask.category}
    `;

    const systemPrompt = `
      You are a professional task breakdown assistant. Please break the provided task into specific, concise subtasks, no more than 7 words each.
      Only return a JSON-formatted array of subtasks, each containing the "label" field.
      Example output format:
      [
        {"label": "Subtask 1"},
        {"label": "Subtask 2"}
      ]
    `;

    // Send the message to the chatbot and get the response
    const aiResponse = await chatbot.sendMessage(userMessage, systemPrompt);

    // Attempt to extract JSON from the AI's response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Unable to parse valid JSON from AI response');
    }

    // Parse the extracted JSON to get the subtasks
    const subtasksRaw = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(subtasksRaw)) {
      throw new Error('AI response is not an array');
    }

    // Convert the raw subtasks into TodoItem objects
    const subtasks: TodoItem[] = subtasksRaw.map(raw => ({
      id: `${parentTask.id}/${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label: raw.label,
      endTime: parentTask.endTime,
      category: parentTask.category,
      checked: false,
      children: []
    }));

    return subtasks;

  } catch (error) {
    console.error('Failed to create subtasks:', error);
    throw error;
  }
}

/**
 * Adds AI-generated subtasks to an existing task.
 * 
 * @param treeProvider - The instance of TodoListViewProvider used to manage the task list.
 * @param task - The task to which subtasks will be added.
 * @returns A promise that resolves when the subtasks are added and the task list is updated.
 * @throws Will throw an error if subtask creation or update fails.
 */
export async function addAIGeneratedSubtasks(
  treeProvider: TodoListViewProvider,
  task: TodoItem
): Promise<void> {
  try {
    // Show a progress notification while the AI is generating subtasks
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "AI is analyzing and generating subtasks...",
      cancellable: false
    }, async () => {
      const subtasks = await createSubtasksWithAI(task);
      // Add the generated subtasks to the task's children
      task.children.push(...subtasks);
      // Notify the treeProvider that the data has changed and needs to be saved
      treeProvider._onDidChangeTreeData.fire(undefined);
      treeProvider.saveToDisk();
    });

    // Show a success message when the subtasks are created successfully
    vscode.window.showInformationMessage(`Successfully created subtasks for task "${task.label}"`);
  } catch (error) {
    // Show an error message if the subtask creation fails
    vscode.window.showErrorMessage(`Failed to generate subtasks: ${(error as Error).message}`);
  }
}
