import * as childProcess from 'child_process';
import * as os from 'os';
import * as vscode from 'vscode';
import { outputChannel } from '../../utils/OutputChannel';

const TCP_PORT = 12345;
const UDP_PORT = 12346;

export class FirewallManager {
    static async autoConfigure() {
        const platform = os.platform();
        outputChannel.info('FirewallManager', `开始配置防火墙 - 平台: ${platform}`);
        try {
            if (await this.isConfigured()) {
                outputChannel.info('FirewallManager', '防火墙规则已存在，无需配置');
                vscode.window.showInformationMessage('防火墙规则已存在，无需配置');
                return;
            }

            outputChannel.info('FirewallManager', '正在配置防火墙规则...');
            vscode.window.showInformationMessage('正在配置防火墙规则...');

            if (platform === 'win32') {
                outputChannel.info('FirewallManager', '为Windows配置防火墙规则');
                await this.configureWindows();
            } else if (platform === 'darwin') {
                outputChannel.info('FirewallManager', '为macOS配置防火墙规则');
                await this.configureMac();
            } else if (platform === 'linux') {
                outputChannel.info('FirewallManager', '为Linux配置防火墙规则');
                await this.configureLinux();
            }

            outputChannel.info('FirewallManager', '防火墙配置完成');
            vscode.window.showInformationMessage('防火墙配置完成');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.error('FirewallManager', `配置防火墙失败: ${errorMsg}`);
            this.showManualInstructions();
        }
    }

    private static async isConfigured(): Promise<boolean> {
        const platform = os.platform();
        outputChannel.info('FirewallManager', `检查防火墙规则是否已存在 - 平台: ${platform}`);
        try {
            let isConfigured = false;
            if (platform === 'win32') {
                isConfigured = await this.checkWindowsRules();
            } else if (platform === 'darwin') {
                isConfigured = await this.checkMacRules();
            } else if (platform === 'linux') {
                isConfigured = await this.checkLinuxRules();
            }
            outputChannel.info('FirewallManager', `防火墙规则检查结果: ${isConfigured ? '已配置' : '未配置'}`);
            return isConfigured;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.error('FirewallManager', `检查防火墙规则失败: ${errorMsg}`);
            return false;
        }
    }

    // region Windows
    private static async checkWindowsRules(): Promise<boolean> {
        outputChannel.info('FirewallManager', '检查Windows防火墙规则');
        const command = `Get-NetFirewallRule | Where-Object { 
            ($_.LocalPort -eq '${TCP_PORT}' -and $_.Protocol -eq 'TCP') -or
            ($_.LocalPort -eq '${UDP_PORT}' -and $_.Protocol -eq 'UDP')
        } | Measure-Object | Select-Object -Expand Count`;

        const result = await this.exec('powershell.exe', ['-Command', command]);
        const count = parseInt(result.trim());
        outputChannel.info('FirewallManager', `Windows防火墙规则检查结果: 找到${count}条规则`);
        return count >= 2;
    }

    private static async configureWindows() {
        outputChannel.info('FirewallManager', `配置Windows防火墙: TCP端口${TCP_PORT}, UDP端口${UDP_PORT}`);
        const script = `
            if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole("Administrators")) {
                throw "需要管理员权限"
            }
            $null = New-NetFirewallRule -DisplayName "VSCode TCP ${TCP_PORT}" -Direction Inbound -Protocol TCP -LocalPort ${TCP_PORT} -Action Allow
            $null = New-NetFirewallRule -DisplayName "VSCode UDP ${UDP_PORT}" -Direction Inbound -Protocol UDP -LocalPort ${UDP_PORT} -Action Allow
        `;
        try {
            await this.execWithElevation('powershell.exe', ['-Command', script], '以管理员身份运行PowerShell');
            outputChannel.info('FirewallManager', 'Windows防火墙规则配置成功');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.error('FirewallManager', `Windows防火墙配置失败: ${errorMsg}`);
            throw error;
        }
    }
    // endregion

    // region macOS
    private static async checkMacRules(): Promise<boolean> {
        outputChannel.info('FirewallManager', '检查macOS防火墙规则');
        const output = await this.exec('/usr/libexec/ApplicationFirewall/socketfilterfw', ['--listall']);
        const tcpRule = new RegExp(`Port\\s+${TCP_PORT}\\s+\$TCP\$\\s+ALLOW`);
        const udpRule = new RegExp(`Port\\s+${UDP_PORT}\\s+\$UDP\$\\s+ALLOW`);
        const tcpExists = tcpRule.test(output);
        const udpExists = udpRule.test(output);
        outputChannel.info('FirewallManager', `macOS防火墙规则检查: TCP规则${tcpExists ? '存在' : '不存在'}, UDP规则${udpExists ? '存在' : '不存在'}`);
        return tcpExists && udpExists;
    }

    private static async configureMac() {
        outputChannel.info('FirewallManager', `配置macOS防火墙: TCP端口${TCP_PORT}, UDP端口${UDP_PORT}`);
        const script = `
            /usr/libexec/ApplicationFirewall/socketfilterfw --addport ${TCP_PORT} --protocol tcp --allow
            /usr/libexec/ApplicationFirewall/socketfilterfw --addport ${UDP_PORT} --protocol udp --allow
            /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
        `;
        try {
            await this.execWithElevation('osascript', ['-e', `do shell script "${script}" with administrator privileges`]);
            outputChannel.info('FirewallManager', 'macOS防火墙规则配置成功');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            outputChannel.error('FirewallManager', `macOS防火墙配置失败: ${errorMsg}`);
            throw error;
        }
    }
    // endregion

    // region Linux
    private static async checkLinuxRules(): Promise<boolean> {
        outputChannel.info('FirewallManager', '检查Linux防火墙规则');
        try {
            // 优先检查ufw
            outputChannel.info('FirewallManager', '尝试检查UFW规则');
            const ufwStatus = await this.exec('sh', ['-c', `ufw status | grep -E "${TCP_PORT}/tcp|${UDP_PORT}/udp"`]);
            if (ufwStatus.includes(`${TCP_PORT}/tcp`) && ufwStatus.includes(`${UDP_PORT}/udp`)) {
                outputChannel.info('FirewallManager', 'UFW防火墙规则已存在');
                return true;
            }
        } catch {
            // 回退到iptables
            outputChannel.info('FirewallManager', 'UFW检查失败，尝试检查iptables规则');
            const iptablesOutput = await this.exec('sh', ['-c', 'iptables -L INPUT -nv --line-numbers']);
            const tcpRule = new RegExp(`dpt:${TCP_PORT}.*ACCEPT`);
            const udpRule = new RegExp(`dpt:${UDP_PORT}.*ACCEPT`);
            const tcpExists = tcpRule.test(iptablesOutput);
            const udpExists = udpRule.test(iptablesOutput);
            outputChannel.info('FirewallManager', `iptables规则检查: TCP规则${tcpExists ? '存在' : '不存在'}, UDP规则${udpExists ? '存在' : '不存在'}`);
            return tcpRule.test(iptablesOutput) && udpRule.test(iptablesOutput);
        }
        outputChannel.info('FirewallManager', 'Linux防火墙规则不存在');
        return false;
    }

    private static async configureLinux() {
        outputChannel.info('FirewallManager', `配置Linux防火墙: TCP端口${TCP_PORT}, UDP端口${UDP_PORT}`);
        try {
            // 尝试使用ufw
            outputChannel.info('FirewallManager', '尝试使用UFW配置防火墙');
            await this.execWithElevation('sh', [
                '-c',
                `ufw allow ${TCP_PORT}/tcp && ufw allow ${UDP_PORT}/udp`
            ], '需要sudo权限');
            outputChannel.info('FirewallManager', 'UFW防火墙规则配置成功');
        } catch (error) {
            // 回退到iptables
            outputChannel.warn('FirewallManager', `UFW配置失败: ${String(error)}, 尝试使用iptables`);
            const iptablesCommands = [
                `iptables -A INPUT -p tcp --dport ${TCP_PORT} -j ACCEPT`,
                `iptables -A INPUT -p udp --dport ${UDP_PORT} -j ACCEPT`,
                `iptables-save > /etc/iptables/rules.v4`
            ];
            try {
                await this.execWithElevation('sh', [
                    '-c',
                    iptablesCommands.join(' && ')
                ], '需要root权限');
                outputChannel.info('FirewallManager', 'iptables防火墙规则配置成功');
            } catch (iptError) {
                const errorMsg = iptError instanceof Error ? iptError.message : String(iptError);
                outputChannel.error('FirewallManager', `iptables配置失败: ${errorMsg}`);
                throw iptError;
            }
        }
    }
    // endregion

    // region 通用方法
    private static exec(command: string, args: string[]): Promise<string> {
        outputChannel.info('FirewallManager', `执行命令: ${command} ${args.join(' ')}`);
        return new Promise((resolve, reject) => {
            childProcess.execFile(command, args, (error, stdout, stderr) => {
                if (error) {
                    outputChannel.error('FirewallManager', `命令执行失败: ${stderr || stdout}`);
                    reject(stderr || stdout);
                } else {
                    outputChannel.info('FirewallManager', '命令执行成功');
                    resolve(stdout.toString());
                }
            });
        });
    }

    private static async execWithElevation(command: string, args: string[], prompt?: string) {
        const platform = os.platform();
        outputChannel.info('FirewallManager', `以管理员权限执行命令: ${command} ${args.join(' ')}`);

        if (platform === 'win32') {
            // Windows使用Start-Process和RunAs来提升权限
            outputChannel.info('FirewallManager', '使用Windows RunAs提升权限');
            try {
                // 使用更可靠的方式运行提权命令
                const psCommand = `
                    $psi = New-Object System.Diagnostics.ProcessStartInfo;
                    $psi.FileName = '${command.replace(/'/g, "''")}'
                    $psi.Arguments = '${args.join(' ').replace(/'/g, "''")}'
                    $psi.Verb = 'runas'
                    $psi.UseShellExecute = $true
                    $process = [System.Diagnostics.Process]::Start($psi)
                    $process.WaitForExit()
                    exit $process.ExitCode
                `;
                await this.exec('powershell.exe', ['-Command', psCommand]);
                return;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                outputChannel.error('FirewallManager', `Windows权限提升失败: ${errorMsg}`);
                throw new Error(`无法获取管理员权限: ${errorMsg}`);
            }
        } else if (platform === 'darwin') {
            // macOS使用osascript提供原生管理员权限对话框
            outputChannel.info('FirewallManager', '使用macOS osascript提升权限');
            try {
                // 防止命令中的特殊字符导致问题
                const escapedCmd = command + ' ' + args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
                outputChannel.info('FirewallManager', `构造的macOS提权命令: ${escapedCmd}`);

                // 使用正确的AppleScript语法
                const result = await this.exec('/usr/bin/osascript', [
                    '-e',
                    'do shell script "' + escapedCmd.replace(/"/g, '\\"') + '" with administrator privileges'
                ]);
                return result;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                outputChannel.error('FirewallManager', `macOS osascript提权失败: ${errorMsg}, 尝试使用sudo`);

                // 如果osascript方法失败，回退到sudo方法
                try {
                    const askForSudoPassword = async (): Promise<string> => {
                        const input = await vscode.window.showInputBox({
                            prompt: prompt || '需要管理员权限，请输入密码',
                            password: true
                        });
                        return input || '';
                    };

                    const password = await askForSudoPassword();
                    if (!password) {
                        outputChannel.error('FirewallManager', '用户取消了密码输入');
                        throw new Error('需要管理员密码才能继续');
                    }

                    return await new Promise<string>((resolve, reject) => {
                        const proc = childProcess.spawn('sudo', ['-S', command, ...args], { stdio: 'pipe' });

                        let stdout = '';
                        let stderr = '';

                        proc.stdout.on('data', (data) => { stdout += data.toString(); });

                        proc.stderr.on('data', (data) => {
                            const str = data.toString();
                            if (str.toLowerCase().includes('password')) {
                                proc.stdin.write(password + '\n');
                            } else {
                                stderr += str;
                            }
                        });

                        proc.on('error', (err) => {
                            reject(new Error(`sudo执行失败: ${err.message}`));
                        });

                        proc.on('close', (code) => {
                            if (code === 0) {
                                outputChannel.info('FirewallManager', 'macOS sudo提权成功');
                                resolve(stdout);
                            } else {
                                reject(new Error(`管理员命令失败: ${stderr}`));
                            }
                        });
                    });
                } catch (sudoError) {
                    const sudoErrorMsg = sudoError instanceof Error ? sudoError.message : String(sudoError);
                    outputChannel.error('FirewallManager', `macOS sudo提权也失败: ${sudoErrorMsg}`);
                    throw new Error(`无法获取管理员权限: ${errorMsg}`);
                }
            }
        }

        // Linux 使用多种方法尝试提权
        outputChannel.info('FirewallManager', '在Linux上尝试多种权限提升方法');

        // 首先尝试使用图形化方式
        const graphicalSudoCommands = [
            { cmd: 'pkexec', args: [command, ...args] },
            { cmd: 'gksudo', args: [`${command} ${args.join(' ')}`] },
            { cmd: 'kdesu', args: [command, ...args] }
        ];

        for (const sudo of graphicalSudoCommands) {
            try {
                outputChannel.info('FirewallManager', `尝试使用 ${sudo.cmd} 提升权限`);
                await this.exec('which', [sudo.cmd]);
                await this.exec(sudo.cmd, sudo.args);
                outputChannel.info('FirewallManager', `使用 ${sudo.cmd} 提权成功`);
                return;
            } catch (error) {
                outputChannel.warn('FirewallManager', `${sudo.cmd} 方法失败，尝试下一个方法`);
            }
        }

        // 回退到终端sudo
        outputChannel.info('FirewallManager', '尝试使用终端sudo提升权限');
        const askForSudoPassword = async (): Promise<string> => {
            const password = await vscode.window.showInputBox({
                prompt: prompt || '需要管理员权限，请输入密码',
                password: true
            });
            return password || '';
        };

        const password = await askForSudoPassword();
        if (!password) {
            outputChannel.error('FirewallManager', '用户取消了密码输入');
            throw new Error('需要管理员密码才能继续');
        }

        return new Promise<string>((resolve, reject) => {
            const sudoArgs = [command, ...args];
            const proc = childProcess.spawn('sudo', ['-S', ...sudoArgs], { stdio: 'pipe' });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                const str = data.toString();
                // 密码提示信息通常输出到stderr
                if (str.toLowerCase().includes('password')) {
                    proc.stdin.write(password + '\n');
                } else {
                    stderr += str;
                }
            });

            proc.on('error', (err) => {
                outputChannel.error('FirewallManager', `sudo执行错误: ${err.message}`);
                reject(new Error(`sudo执行失败: ${err.message}`));
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    outputChannel.info('FirewallManager', '使用sudo提权成功');
                    resolve(stdout);
                } else {
                    outputChannel.error('FirewallManager', `sudo执行失败，退出码: ${code}, 错误: ${stderr}`);
                    reject(new Error(`管理员命令失败，可能是密码错误: ${stderr}`));
                }
            });
        });
    }

    private static showManualInstructions() {
        outputChannel.info('FirewallManager', '显示手动配置指南');
        const guide = `
            **手动配置指南：**
            Windows (管理员PowerShell):
              New-NetFirewallRule -DisplayName "VSCode TCP ${TCP_PORT}" -Direction Inbound -Protocol TCP -LocalPort ${TCP_PORT} -Action Allow
              New-NetFirewallRule -DisplayName "VSCode UDP ${UDP_PORT}" -Direction Inbound -Protocol UDP -LocalPort ${UDP_PORT} -Action Allow

            macOS/Linux (终端):
              sudo iptables -A INPUT -p tcp --dport ${TCP_PORT} -j ACCEPT
              sudo iptables -A INPUT -p udp --dport ${UDP_PORT} -j ACCEPT
              sudo iptables-save

            或使用UFW (Linux):
              sudo ufw allow ${TCP_PORT}/tcp
              sudo ufw allow ${UDP_PORT}/udp
        `;

        const panel = vscode.window.createWebviewPanel(
            'firewallHelp',
            '防火墙配置指南',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        panel.webview.html = `<pre>${guide}</pre>`;
    }
    // endregion
}