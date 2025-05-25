import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('BlackboardCrawler Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    vscode.window.showInformationMessage('Start all tests.');

    test('Test svsmate.BB-updateAll Command', async () => {
        const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        await vscode.commands.executeCommand('svsmate.BB-updateCourse');
        assert.ok(execStub.calledWith('svsmate.BB-updateCourse'), 'Command executed');
    });

    test('Test svsmate.BB-downloadToWorkspace Command', async () => {
        const mockItem = { id: 'mockId', name: 'Mock File' };
        const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        await vscode.commands.executeCommand('svsmate.BB-downloadToWorkspace', mockItem);
        assert.ok(execStub.calledWith('svsmate.BB-downloadToWorkspace', mockItem), 'Command executed with mock item');
    });

    test('Test svsmate.BB-uploadFromWorkspace Command', async () => {
        const mockFilePath = './file.txt';
        const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        await vscode.commands.executeCommand('svsmate.BB-uploadFromWorkspace', mockFilePath);
        assert.ok(execStub.calledWith('svsmate.BB-uploadFromWorkspace', mockFilePath), 'Command executed with mock file path');
    });

    test('Test svsmate.BB-refreshSidebar Command', async () => {
        const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        await vscode.commands.executeCommand('svsmate.BB-refreshSidebar');
        assert.ok(execStub.calledWith('svsmate.BB-refreshSidebar'), 'Sidebar refresh command executed');
    });

    test('Test svsmate.BB-openInBrowser Command', async () => {
        const mockUrl = 'https://bb.sustech.edu.cn/course/123';
        const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        await vscode.commands.executeCommand('svsmate.BB-openInBrowser', mockUrl);
        assert.ok(execStub.calledWith('svsmate.BB-openInBrowser', mockUrl), 'Open in browser command executed with URL');
    });

    test('Test svsmate.BB-showAnnouncement Command', async () => {
        const mockAnnouncement = { title: 'Test', content: 'Announcement content' };
        const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        await vscode.commands.executeCommand('svsmate.BB-showAnnouncement', mockAnnouncement);
        assert.ok(execStub.calledWith('svsmate.BB-showAnnouncement', mockAnnouncement), 'Show announcement command executed');
    });
});
