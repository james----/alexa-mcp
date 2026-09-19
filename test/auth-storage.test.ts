import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AlexaClient } from '../src/alexa-client.js';

describe('Auth Storage & Security Invariants', () => {
  let testDir: string;
  const originalEnvAuthDir = process.env.ALEXA_MCP_AUTH_DIR;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexa-mcp-test-auth-'));
    process.env.ALEXA_MCP_AUTH_DIR = testDir;
  });

  afterEach(() => {
    if (originalEnvAuthDir !== undefined) {
      process.env.ALEXA_MCP_AUTH_DIR = originalEnvAuthDir;
    } else {
      delete process.env.ALEXA_MCP_AUTH_DIR;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('resolves custom ALEXA_MCP_AUTH_DIR and tilde expansion', () => {
    const client = new AlexaClient();
    const resolved = client.resolveAuthDir();
    assert.equal(resolved, testDir);
    assert.equal(client.authDir, testDir);

    process.env.ALEXA_MCP_AUTH_DIR = '~/custom-alexa-auth';
    const clientTilde = new AlexaClient();
    const resolvedTilde = clientTilde.resolveAuthDir();
    assert.equal(resolvedTilde, path.join(os.homedir(), 'custom-alexa-auth'));
  });

  test('_saveAuth writes atomic credentials file with mode 0600 and dir mode 0700', () => {
    const targetDir = path.join(testDir, 'nested', 'auth');
    process.env.ALEXA_MCP_AUTH_DIR = targetDir;

    const client = new AlexaClient();
    const dummyAuth = {
      cookie: 'test-cookie=123',
      macDms: {
        device_private_key: 'test-private-key',
        adp_token: 'test-adp-token',
      },
    };

    (client as any)._saveAuth(dummyAuth);

    const authFilePath = path.join(targetDir, 'auth.json');
    assert.ok(fs.existsSync(authFilePath), 'auth.json must exist');

    // Verify directory mode is 0700 on POSIX
    if (process.platform !== 'win32') {
      const dirStat = fs.statSync(targetDir);
      assert.equal(dirStat.mode & 0o777, 0o700, 'Directory permissions must be 0700');

      const fileStat = fs.statSync(authFilePath);
      assert.equal(fileStat.mode & 0o777, 0o600, 'File permissions must be 0600');
    }

    // Verify contents
    const readData = JSON.parse(fs.readFileSync(authFilePath, 'utf-8'));
    assert.deepEqual(readData, dummyAuth);

    // Verify no stray temp files remain
    const files = fs.readdirSync(targetDir);
    assert.deepEqual(files, ['auth.json']);
  });

  test('tightens pre-existing loose directory permissions to 0700', () => {
    const looseDir = path.join(testDir, 'loose');
    fs.mkdirSync(looseDir, { mode: 0o755 });
    process.env.ALEXA_MCP_AUTH_DIR = looseDir;

    const client = new AlexaClient();
    const dummyAuth = { cookie: 'test', macDms: { device_private_key: 'pk' } };
    (client as any)._saveAuth(dummyAuth);

    if (process.platform !== 'win32') {
      const dirStat = fs.statSync(looseDir);
      assert.equal(dirStat.mode & 0o777, 0o700, 'Loose directory must be tightened to 0700');
    }
  });

  test('rejects saved auth that lacks macDms device registration', async () => {
    const authFilePath = path.join(testDir, 'auth.json');
    fs.writeFileSync(
      authFilePath,
      JSON.stringify({ cookie: 'cookie-without-macdms' }),
      { mode: 0o600 }
    );

    const client = new AlexaClient();
    await assert.rejects(
      async () => {
        await client.init();
      },
      (err: any) => {
        return (
          err.message.includes('has no usable device registration (macDms)') &&
          err.message.includes('Run "npm run auth"')
        );
      }
    );
  });
});
