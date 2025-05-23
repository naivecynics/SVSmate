import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as commands from '../../backend/todo/todoCommands';
import { TodoListViewProvider, TodoItem } from '../../frontend/TodoListView';

suite('Todo Commands Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockProvider: TodoListViewProvider;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockProvider = {
      addItem: sandbox.stub(),
      editTask: sandbox.stub(),
      deleteTask: sandbox.stub(),
      toggleTaskCheckbox: sandbox.stub(),
      sortBy: sandbox.stub(),
      setSearchTerm: sandbox.stub(),
      clearSearch: sandbox.stub(),
      addSubTask: sandbox.stub(),
      loadICSFile: sandbox.stub()
    } as any;
  });

  teardown(() => {
    sandbox.restore();
  });

  test('addItem should call addItem with correct parameters', async () => {
    sandbox.stub(vscode.window, 'showInputBox')
      .onFirstCall().resolves('Task A')
      .onSecondCall().resolves('2025-05-19')
      .onThirdCall().resolves('Work');

    await commands.addItem(mockProvider);
    assert.ok((mockProvider.addItem as sinon.SinonStub).calledWith('Task A', '2025-05-19', 'Work'));
  });

  test('addItem should not call addItem if task name is not provided', async () => {
    sandbox.stub(vscode.window, 'showInputBox').onFirstCall().resolves(undefined);

    await commands.addItem(mockProvider);
    assert.ok(!(mockProvider.addItem as sinon.SinonStub).called);
  });

  test('editTask should call editTask on provider', async () => {
    const item = { label: 'task' } as TodoItem;
    await commands.editTask(mockProvider, item);
    assert.ok((mockProvider.editTask as sinon.SinonStub).calledWith(item));
  });

  test('deleteTask should call deleteTask on provider', async () => {
    const item = { label: 'task' } as TodoItem;
    await commands.deleteTask(mockProvider, item);
    assert.ok((mockProvider.deleteTask as sinon.SinonStub).calledWith(item));
  });

  test('toggleTaskCheckbox should call toggleTaskCheckbox on provider', async () => {
    const item = { label: 'task' } as TodoItem;
    await commands.toggleTaskCheckbox(mockProvider, item);
    assert.ok((mockProvider.toggleTaskCheckbox as sinon.SinonStub).calledWith(item));
  });

  test('sortByEndTime should call sortBy with "endTime"', async () => {
    await commands.sortByEndTime(mockProvider);
    assert.ok((mockProvider.sortBy as sinon.SinonStub).calledWith('endTime'));
  });

  test('sortByKinds should call sortBy with "category"', async () => {
    await commands.sortByKinds(mockProvider);
    assert.ok((mockProvider.sortBy as sinon.SinonStub).calledWith('category'));
  });

  test('searchTasks should call setSearchTerm with input', async () => {
    sandbox.stub(vscode.window, 'showInputBox').resolves('search term');
    await commands.searchTasks(mockProvider);
    assert.ok((mockProvider.setSearchTerm as sinon.SinonStub).calledWith('search term'));
  });

  test('clearSearch should call clearSearch', async () => {
    await commands.clearSearch(mockProvider);
    assert.ok((mockProvider.clearSearch as sinon.SinonStub).called);
  });

  test('addSubTask should call addSubTask with parent', async () => {
    const parent = { label: 'parent task' } as TodoItem;
    await commands.addSubTask(mockProvider, parent);
    assert.ok((mockProvider.addSubTask as sinon.SinonStub).calledWith(parent));
  });

  test('loadICSFile should call loadICSFile with valid URL', async () => {
    sandbox.stub(vscode.window, 'showInputBox').resolves('http://example.com/calendar.ics');
    await commands.loadICSFile(mockProvider);
    assert.ok((mockProvider.loadICSFile as sinon.SinonStub).calledWith('http://example.com/calendar.ics'));
  });

  test('loadICSFile should show error on invalid URL', async () => {
    const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.stub(vscode.window, 'showInputBox').resolves('not-a-url');

    await commands.loadICSFile(mockProvider);
    assert.ok(errorStub.calledWith('Please enter a valid .ics URL (must start with http)'));
    assert.ok(!(mockProvider.loadICSFile as sinon.SinonStub).called);
  });
});
