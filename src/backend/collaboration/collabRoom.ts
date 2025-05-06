import * as net from 'net';
import * as dgram from 'dgram';
import * as os from 'os';
import * as vscode from 'vscode';

const DEFAULT_TCP_PORT = 12345;
const DEFAULT_UDP_PORT = 12346;

export class ConnectionManager {
    private tcpServer: net.Server | null = null;
    private tcpClient: net.Socket | null = null;
    private udpSocket: dgram.Socket | null = null;
    private targetUdpInfo: { address: string; port: number } | null = null;

    // 获取本机IP
    getLocalIp(): string {
        const interfaces = os.networkInterfaces();
        for (const iface of Object.values(interfaces).flat()) {
            if (iface && iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
        return '0.0.0.0';
    }

    // 启动TCP服务器
    startTcpServer() {
        this.tcpServer = net.createServer(socket => {
            this.tcpClient = socket;
            socket.on('data', data => this.handleTcpData(data));
            socket.on('close', () => this.tcpClient = null);
        });

        this.tcpServer.listen(DEFAULT_TCP_PORT, () => {
            vscode.window.showInformationMessage(`TCP Server started on ${this.getLocalIp()}:${DEFAULT_TCP_PORT}`);
        });
    }

    // 启动UDP服务器
    startUdpServer() {
        this.udpSocket = dgram.createSocket('udp4');
        this.udpSocket.bind(DEFAULT_UDP_PORT);

        this.udpSocket.on('message', (msg, rinfo) => {
            this.handleUdpData(msg, rinfo.address);
        });
    }

    // 连接远程服务器
    async connect(ip: string) {
        // 连接TCP
        this.tcpClient = net.connect(DEFAULT_TCP_PORT, ip, () => {
            vscode.window.showInformationMessage(`Connected to ${ip}:${DEFAULT_TCP_PORT}`);
        });

        // 设置UDP目标
        this.targetUdpInfo = { address: ip, port: DEFAULT_UDP_PORT };
    }

    // 发送文字消息
    sendMessage(message: string) {
        if (this.tcpClient) {
            this.tcpClient.write(message);
        }
    }

    // 发送光标位置
    sendCursorPosition(position: vscode.Position) {
        if (this.udpSocket && this.targetUdpInfo) {
            const data = JSON.stringify({
                line: position.line + 1,
                column: position.character + 1
            });
            this.udpSocket.send(data, this.targetUdpInfo.port, this.targetUdpInfo.address);
        }
    }

    private handleTcpData(data: Buffer) {
        vscode.window.showInformationMessage(`Received message: ${data.toString()}`);
    }

    private handleUdpData(data: Buffer, fromIp: string) {
        try {
            const pos = JSON.parse(data.toString());
            vscode.window.showInformationMessage(`Cursor at ${fromIp}: Line ${pos.line}, Column ${pos.column}`);
        } catch {
            vscode.window.showErrorMessage('Invalid cursor data');
        }
    }

    // 断开连接
    disconnect() {
        this.tcpClient?.destroy();
        this.tcpServer?.close();
        this.udpSocket?.close();
    }
}