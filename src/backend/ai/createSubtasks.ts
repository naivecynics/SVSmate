import { ChatBot } from './ChatBot';
import * as vscode from "vscode";

interface TodoItem {
  id: string;
  label: string;
  endTime: string;
  category: string;
  checked: boolean;
  children: TodoItem[];
}

/**
 * 使用AI将任务拆分为子任务
 * @param taskDescription 任务描述
 * @param numberOfSubtasks 子任务数量上限
 * @returns 子任务数组
 */
export async function createSubtasksWithAI(
  parentTask: TodoItem,
  numberOfSubtasks: number = 5
): Promise<TodoItem[]> {
  try {
    const chatbot = new ChatBot();
    
    const userMessage = `
请将以下任务分解成${numberOfSubtasks}个或更少的具体子任务。
每个子任务应该是清晰、可操作的步骤。

主任务: ${parentTask.label}
任务描述: ${parentTask.category}
`;

    const systemPrompt = `
你是一个专业的任务拆解助手。请将用户提供的任务拆解为具体、精确而简短的子任务，字数不多于7个字。
仅返回一个JSON格式的子任务数组，每个子任务只需包含"label"字段。
示例输出格式:
[
  {"label": "子任务1"},
  {"label": "子任务2"}
]
`;

    const aiResponse = await chatbot.sendMessage(userMessage, systemPrompt);
    
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('无法从AI响应中解析出有效的JSON');
    }
    
    const subtasksRaw = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(subtasksRaw)) {
      throw new Error('AI返回的不是数组');
    }
    
    // 转换为完整的TodoItem数组
    const subtasks: TodoItem[] = subtasksRaw.map(raw => ({
      id: `${parentTask.id}/${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label: raw.label,
      endTime: parentTask.endTime,  // 继承父任务的截止时间
      category: parentTask.category, // 继承父任务的分类
      checked: false,
      children: []
    }));
    
    return subtasks;

  } catch (error) {
    console.error('创建子任务失败:', error);
    throw error;
  }
}

/**
 * 添加AI生成的子任务到现有任务中
 * @param task 要添加子任务的任务
 * @param treeProvider TodoListView提供者实例
 */
export async function addAIGeneratedSubtasks(
  task: TodoItem,
  treeProvider: any  // 实际使用时替换为 TodoListViewProvider 类型
): Promise<void> {
  try {
    // 显示进度提示
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "AI正在分析并生成子任务...",
      cancellable: false
    }, async () => {
      // 生成子任务
      const subtasks = await createSubtasksWithAI(task);
      
      // 添加到父任务
      task.children.push(...subtasks);
      
      // 刷新视图
      treeProvider._onDidChangeTreeData.fire(undefined);
      
      // 保存到磁盘
      treeProvider.saveToDisk();
    });
    
    vscode.window.showInformationMessage(`成功为任务 "${task.label}" 创建子任务`);
  } catch (error) {
    vscode.window.showErrorMessage(`生成子任务失败: ${(error as Error).message}`);
  }
}