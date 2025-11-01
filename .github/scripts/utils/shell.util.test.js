import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import process from 'node:process';
import { ShellUtil } from './shell.util.js';

describe('ShellUtil', () => {
    let mockCPApi;
    let shellUtil;

    beforeEach(() => {
        mockCPApi = {
            execSync: mock.fn()
        };
        shellUtil = new ShellUtil(mockCPApi);
    });

    afterEach(() => {
        mock.reset();
    });

    describe('exec()', () => {
        it('should return an object with stdout when command succeeds', () => {
            mockCPApi.execSync.mock.mockImplementationOnce(() => 'mocked output');

            const result = shellUtil.exec('test command');

            assert.deepStrictEqual(result, { stdout: 'mocked output' });
            assert.strictEqual(mockCPApi.execSync.mock.callCount(), 1);
            assert.strictEqual(mockCPApi.execSync.mock.calls[0].arguments[0], 'test command');
        });

        it('should return an object with empty stdout if command output is null/undefined', () => {
            mockCPApi.execSync.mock.mockImplementationOnce(() => null);

            const result = shellUtil.exec('test command without output');

            assert.deepStrictEqual(result, { stdout: '' });
        });

        it('should return an object with stdout when stdio is pipe (Buffer output)', () => {
            mockCPApi.execSync.mock.mockImplementationOnce(() => Buffer.from('piped output'));

            const result = shellUtil.exec('test command with pipe', { stdio: 'pipe' });

            assert.deepStrictEqual(result, { stdout: 'piped output' });
            assert.strictEqual(mockCPApi.execSync.mock.callCount(), 1);
            assert.deepStrictEqual(mockCPApi.execSync.mock.calls[0].arguments[1], { stdio: 'pipe' });
        });

        it('should exit process on command failure', () => {
            const mockExit = mock.method(process, 'exit');
            mockExit.mock.mockImplementation(() => { });

            mockCPApi.execSync.mock.mockImplementationOnce(() => { throw new Error('Command failed'); });

            shellUtil.exec('failing command');

            assert.strictEqual(mockExit.mock.callCount(), 1);
            assert.strictEqual(mockExit.mock.calls[0].arguments[0], 1);
        });

        it('should throw error instead of exiting when stdio is pipe', () => {
            const mockExit = mock.method(process, 'exit');
            mockExit.mock.mockImplementation(() => { });

            mockCPApi.execSync.mock.mockImplementationOnce(() => { throw new Error('Command failed'); });

            assert.throws(() => {
                shellUtil.exec('failing command', { stdio: 'pipe' });
            }, /Command failed/);

            assert.strictEqual(mockExit.mock.callCount(), 0);
        });
    });
});