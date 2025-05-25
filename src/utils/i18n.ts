import * as vscode from 'vscode';

/**
 * 获取本地化字符串
 * @param key 翻译键
 * @param defaultValue 默认英文值
 */
export function localize(key: string, defaultValue: string): string {
  return vscode.l10n.t(key, defaultValue);
}