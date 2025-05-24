import * as vscode from 'vscode';

// DEBUG CONSOLE - not exposed to user
// console.log('Congratulations, your extension "svsmate" is now active!');

/**
 * A utility class for managing output channels in VS Code.
 * Provides methods to log informational, warning, and error messages with timestamps.
 */
class stdOutputChannel {
    /** The output channel instance */
    private output: any;

    /**
     * Creates a new output channel with the specified name.
     * @param name - The name of the output channel. Defaults to 'svsmate'.
     */
    constructor(name: string = 'svsmate') {
        this.output = vscode.window.createOutputChannel(name);
        this.output.show();
    }

    /**
     * Logs an informational message to the output channel.
     * @param module - The module or context of the message.
     * @param msg - The informational message to log.
     */
    public async info(module: string, msg: string) {
        const timestamp = new Date().toISOString();
        const log = `[${timestamp}] [INFO] [${module}] ${msg}`;
        this.output.appendLine(log);
    }

    /**
     * Logs a warning message to the output channel.
     * @param module - The module or context of the message.
     * @param msg - The warning message to log.
     */
    public async warn(module: string, msg: string) {
        const timestamp = new Date().toISOString();
        const log = `[${timestamp}] [WARN] [${module}] ${msg}`;
        this.output.appendLine(log);
    }

    /**
     * Logs an error message to the output channel.
     * @param module - The module or context of the message.
     * @param msg - The error message to log.
     */
    public async error(module: string, msg: string) {
        const timestamp = new Date().toISOString();
        const log = `[${timestamp}] [ERROR] [${module}] ${msg}`;
        this.output.appendLine(log);
    }
}

/**
 * An instance of the stdOutputChannel class for logging messages.
 */
export const outputChannel = new stdOutputChannel();
