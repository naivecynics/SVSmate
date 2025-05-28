/**
 * Collaboration Commands Module
 * 
 * Provides command functions for starting/stopping the collaboration server, connecting/disconnecting as a client,
 * sharing files, opening shared files, discovering servers, sending messages, and changing username.
 * 
 * Functions:
 * - startServer: Start the collaboration server
 * - stopServer: Stop the collaboration server
 * - connectToServer: Connect to a collaboration server as a client
 * - disconnectFromServer: Disconnect from the collaboration server
 * - shareCurrentFile: Share the currently active file
 * - shareFile: Share a file from the file explorer
 * - openSharedFile: Open a shared file from the server or client
 * - showServerInfo: Show information about the running server
 * - showClientInfo: Show information about the client connection
 * - discoverServers: Discover available servers on the network
 * - connectToDiscoveredServer: Connect to a discovered server
 * - refreshDiscoveredServers: Refresh the list of discovered servers
 * - sendMessage: Send a chat message to the server or clients
 * - changeUsername: Change the collaboration username
 * - showLatestMessage: Show the latest chat message
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { collaborationServer } from './collaborationServer';
import { collaborationClient } from './collaborationClient';
import { SharedFilesViewProvider, SharedFilesItem } from '../../frontend/SharedFilesView';

/**
 * Start the collaboration server
 */
export async function startServer(provider: SharedFilesViewProvider): Promise<void> {
    try {
        await collaborationServer.start();
        provider.refresh();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start server: ${error}`);
    }
}

/**
 * Stop the collaboration server
 */
export async function stopServer(provider: SharedFilesViewProvider): Promise<void> {
    collaborationServer.stop();
    provider.refresh();
}

/**
 * Connect to a collaboration server
 */
export async function connectToServer(provider: SharedFilesViewProvider): Promise<void> {
    const ip = await vscode.window.showInputBox({
        prompt: 'Enter server IP address',
        placeHolder: '192.168.1.100',
        validateInput: (value) => {
            if (!value) { return 'IP address is required'; }
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(value)) { return 'Invalid IP address format'; }
            return null;
        }
    });

    if (!ip) { return; }

    const portStr = await vscode.window.showInputBox({
        prompt: 'Enter server port',
        placeHolder: '8080',
        validateInput: (value) => {
            if (!value) { return 'Port is required'; }
            const port = parseInt(value);
            if (isNaN(port) || port < 1 || port > 65535) { return 'Invalid port number'; }
            return null;
        }
    });

    if (!portStr) { return; }

    const port = parseInt(portStr);

    try {
        await collaborationClient.connect(ip, port);
        provider.refresh();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect to server: ${error}`);
    }
}

/**
 * Disconnect from the collaboration server
 */
export async function disconnectFromServer(provider: SharedFilesViewProvider): Promise<void> {
    await collaborationClient.disconnect();
    provider.refresh();
}

/**
 * Share the currently active file
 */
export async function shareCurrentFile(provider: SharedFilesViewProvider): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showErrorMessage('No active file to share');
        return;
    }

    const document = activeEditor.document;
    if (document.isUntitled) {
        vscode.window.showErrorMessage('Cannot share untitled files. Please save the file first.');
        return;
    }

    const serverInfo = collaborationServer.getServerInfo();
    if (!serverInfo.isRunning) {
        vscode.window.showErrorMessage('Server is not running. Start the server first.');
        return;
    }

    // Save the file first to ensure we have the latest content
    await document.save();

    const success = collaborationServer.shareFile(document.fileName);
    if (success) {
        provider.refresh();
    }
}

/**
 * Share a file from the file explorer
 */
export async function shareFile(provider: SharedFilesViewProvider, fileUri: vscode.Uri): Promise<void> {
    const serverInfo = collaborationServer.getServerInfo();
    if (!serverInfo.isRunning) {
        vscode.window.showErrorMessage('Server is not running. Start the server first.');
        return;
    }

    const success = collaborationServer.shareFile(fileUri.fsPath);
    if (success) {
        provider.refresh();
    }
}

/**
 * Open a shared file from the server
 */
export async function openSharedFile(item: SharedFilesItem): Promise<void> {
    if (!item.fileId) {
        vscode.window.showErrorMessage('Invalid file item');
        return;
    }

    if (item.type === 'clientFile') {
        await collaborationClient.openSharedFile(item.fileId);
    } else if (item.type === 'serverFile') {
        // For server files, open the local file directly and set up sync
        const sharedFiles = collaborationServer.getSharedFiles();
        const file = sharedFiles.find(f => f.id === item.fileId);
        if (file) {
            const document = await vscode.workspace.openTextDocument(file.path);
            await vscode.window.showTextDocument(document);

            // Set up document change listener for server-side sync
            const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document === document) {
                    // Update the shared file content and notify clients
                    collaborationServer.updateFileContent(file.id, event.document.getText(), false);
                }
            });

            // Clean up listener when document is closed
            const closeListener = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
                if (closedDoc === document) {
                    changeListener.dispose();
                    closeListener.dispose();
                }
            });
        }
    }
}

/**
 * Show collaboration server info
 */
export async function showServerInfo(): Promise<void> {
    const serverInfo = collaborationServer.getServerInfo();
    const clients = collaborationServer.getConnectedClients();
    const sharedFiles = collaborationServer.getSharedFiles();

    let message = `Server Status: ${serverInfo.isRunning ? 'Running' : 'Stopped'}\n`;

    if (serverInfo.isRunning) {
        message += `Address: ${serverInfo.ip}:${serverInfo.port}\n`;
        message += `Connected Clients: ${serverInfo.clientCount}\n`;
        message += `Shared Files: ${sharedFiles.length}\n\n`;

        if (clients.length > 0) {
            message += 'Connected Clients:\n';
            clients.forEach(client => {
                message += `- ${client.name} (${client.ip})\n`;
            });
        }

        if (sharedFiles.length > 0) {
            message += '\nShared Files:\n';
            sharedFiles.forEach(file => {
                message += `- ${file.name}\n`;
            });
        }
    }

    vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Show collaboration client info
 */
export async function showClientInfo(): Promise<void> {
    const clientInfo = collaborationClient.getConnectionInfo();
    const serverFiles = collaborationClient.getServerFiles();

    let message = `Client Status: ${clientInfo.isConnected ? 'Connected' : 'Disconnected'}\n`;

    if (clientInfo.isConnected) {
        message += `Server: ${clientInfo.serverIP}:${clientInfo.serverPort}\n`;
        message += `Available Files: ${serverFiles.length}\n\n`;

        if (serverFiles.length > 0) {
            message += 'Available Files:\n';
            serverFiles.forEach(file => {
                message += `- ${file.name}\n`;
            });
        }
    }

    vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Discover available servers on the network
 */
export async function discoverServers(provider: SharedFilesViewProvider): Promise<void> {
    vscode.window.showInformationMessage('Scanning network for collaboration servers...');

    try {
        const servers = await collaborationClient.discoverServers();
        provider.refresh();

        if (servers.length === 0) {
            const action = await vscode.window.showInformationMessage(
                'No servers found. Would you like to start your own server?',
                'Start Server',
                'Cancel'
            );

            if (action === 'Start Server') {
                await startServer(provider);
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to discover servers: ${error}`);
    }
}

/**
 * Connect to a discovered server
 */
export async function connectToDiscoveredServer(provider: SharedFilesViewProvider, item: SharedFilesItem): Promise<void> {
    if (!item.serverInfo) {
        vscode.window.showErrorMessage('Invalid server information');
        return;
    }

    try {
        await collaborationClient.connectToDiscoveredServer(item.serverInfo);
        provider.refresh();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect to server: ${error}`);
    }
}

/**
 * Refresh discovered servers
 */
export async function refreshDiscoveredServers(provider: SharedFilesViewProvider): Promise<void> {
    await discoverServers(provider);
}

/**
 * Send a chat message
 */
export async function sendMessage(): Promise<void> {
    const clientInfo = collaborationClient.getConnectionInfo();
    const serverInfo = collaborationServer.getServerInfo();

    if (!clientInfo.isConnected && !serverInfo.isRunning) {
        vscode.window.showErrorMessage('Not connected to any server and no server running');
        return;
    }

    const message = await vscode.window.showInputBox({
        prompt: 'Enter your message',
        placeHolder: 'Type your message here...'
    });

    if (!message) {
        return;
    }

    if (clientInfo.isConnected) {
        // Send as client
        collaborationClient.sendMessage(message);
        vscode.window.setStatusBarMessage(`💬 ${collaborationClient.getUsername()}: ${message}`, 3000);
    } else if (serverInfo.isRunning) {
        // Send as server (broadcast to all clients)
        collaborationServer.sendServerMessage(message);
    }
}

/**
 * Change username
 */
export async function changeUsername(): Promise<void> {
    const currentUsername = collaborationClient.getUsername() || collaborationServer.getUsername();

    const newUsername = await vscode.window.showInputBox({
        prompt: 'Enter your new username',
        placeHolder: 'Your username',
        value: currentUsername,
        validateInput: (value) => {
            if (!value || !value.trim()) {
                return 'Username cannot be empty';
            }
            if (value.trim().length > 50) {
                return 'Username is too long (max 50 characters)';
            }
            return null;
        }
    });

    if (!newUsername) {
        return;
    }

    // Update both client and server usernames
    await collaborationClient.setUsername(newUsername);
    await collaborationServer.setUsername(newUsername);
}

/**
 * Show latest message
 */
export async function showLatestMessage(): Promise<void> {
    const clientMessage = collaborationClient.getLatestMessage();
    const serverMessage = collaborationServer.getLatestMessage();

    let latestMessage = clientMessage;
    if (serverMessage && (!clientMessage || serverMessage.timestamp > clientMessage.timestamp)) {
        latestMessage = serverMessage;
    }

    if (latestMessage) {
        const timeStr = new Date(latestMessage.timestamp).toLocaleTimeString();
        vscode.window.showInformationMessage(
            `💬 ${latestMessage.sender} (${timeStr}): ${latestMessage.content}`,
            { modal: true }
        );
    } else {
        vscode.window.showInformationMessage('No messages yet');
    }
}
