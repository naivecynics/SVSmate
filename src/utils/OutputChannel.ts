import * as vscode from 'vscode';

// DEBUG CONSOLE - not exposed to user
// console.log('Congratulations, your extension "svsmate" is now active!');

// OUTPUT - exposed to user
class stdOutputChannel {
	private output: any;
	constructor(name: string = 'svsmate') {
		this.output = vscode.window.createOutputChannel(name);
		this.output.show();
	}

	public async info(module: string, msg: string) {
		const timestamp = new Date().toISOString();
		const log = `[${timestamp}] [INFO] [${module}] ${msg}`;
		this.output.appendLine(log);
	}

	public async warn(module: string, msg: string) {
		const timestamp = new Date().toISOString();
		const log = `[${timestamp}] [WARN] [${module}] ${msg}`;
		this.output.appendLine(log);
	}

	public async error(module: string, msg: string) {
		const timestamp = new Date().toISOString();
		const log = `[${timestamp}] [ERROR] [${module}] ${msg}`;
		this.output.appendLine(log);
	}
}

export const outputChannel = new stdOutputChannel();
