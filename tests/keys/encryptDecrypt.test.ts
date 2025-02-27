import type { StatusLive } from 'polykey/dist/status/types';
import path from 'path';
import fs from 'fs';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import * as keysUtils from 'polykey/dist/keys/utils';
import * as nodesUtils from 'polykey/dist/nodes/utils';
import sysexits from 'polykey/dist/utils/sysexits';
import * as testUtils from '../utils';

describe('encrypt-decrypt', () => {
  const logger = new Logger('encrypt-decrypt test', LogLevel.WARN, [
    new StreamHandler(),
  ]);
  let agentDir;
  let agentPassword;
  let agentClose;
  let agentStatus: StatusLive;
  beforeEach(async () => {
    ({ agentDir, agentPassword, agentClose, agentStatus } =
      await testUtils.setupTestAgent(logger));
  });
  afterEach(async () => {
    await agentClose();
  });
  testUtils.testIf(
    testUtils.isTestPlatformEmpty || testUtils.isTestPlatformDocker,
  )('decrypts data', async () => {
    const dataPath = path.join(agentDir, 'data');
    const publicKey = keysUtils.publicKeyFromNodeId(agentStatus.data.nodeId);
    const encrypted = keysUtils.encryptWithPublicKey(
      publicKey,
      Buffer.from('abc'),
    );
    await fs.promises.writeFile(dataPath, encrypted, {
      encoding: 'binary',
    });
    const { exitCode, stdout } = await testUtils.pkExec(
      ['keys', 'decrypt', dataPath, '--format', 'json'],
      {
        env: {
          PK_NODE_PATH: agentDir,
          PK_PASSWORD: agentPassword,
        },
        cwd: agentDir,
        command: globalThis.testCmd,
      },
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      decryptedData: 'abc',
    });
  });
  testUtils.testIf(
    testUtils.isTestPlatformEmpty || testUtils.isTestPlatformDocker,
  )('encrypts data using NodeId', async () => {
    const targetkeyPair = keysUtils.generateKeyPair();
    const targetNodeId = keysUtils.publicKeyToNodeId(targetkeyPair.publicKey);

    const dataPath = path.join(agentDir, 'data');
    await fs.promises.writeFile(dataPath, 'abc', {
      encoding: 'binary',
    });
    const { exitCode, stdout } = await testUtils.pkExec(
      [
        'keys',
        'encrypt',
        dataPath,
        nodesUtils.encodeNodeId(targetNodeId),
        '--format',
        'json',
      ],
      {
        env: {
          PK_NODE_PATH: agentDir,
          PK_PASSWORD: agentPassword,
        },
        cwd: agentDir,
        command: globalThis.testCmd,
      },
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      encryptedData: expect.any(String),
    });
    const encrypted = JSON.parse(stdout).encryptedData;
    const decrypted = keysUtils.decryptWithPrivateKey(
      targetkeyPair,
      Buffer.from(encrypted, 'binary'),
    );
    expect(decrypted?.toString()).toBe('abc');
  });
  testUtils.testIf(
    testUtils.isTestPlatformEmpty || testUtils.isTestPlatformDocker,
  )('encrypts data using JWK file', async () => {
    const targetkeyPair = keysUtils.generateKeyPair();
    const publicJWK = keysUtils.publicKeyToJWK(targetkeyPair.publicKey);

    const dataPath = path.join(agentDir, 'data');
    const jwkPath = path.join(agentDir, 'jwk');
    await fs.promises.writeFile(jwkPath, JSON.stringify(publicJWK), 'utf-8');
    await fs.promises.writeFile(dataPath, 'abc', {
      encoding: 'binary',
    });
    const { exitCode, stdout } = await testUtils.pkExec(
      ['keys', 'encrypt', dataPath, jwkPath, '--format', 'json'],
      {
        env: {
          PK_NODE_PATH: agentDir,
          PK_PASSWORD: agentPassword,
        },
        cwd: agentDir,
        command: globalThis.testCmd,
      },
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      encryptedData: expect.any(String),
    });
    const encrypted = JSON.parse(stdout).encryptedData;
    const decrypted = keysUtils.decryptWithPrivateKey(
      targetkeyPair,
      Buffer.from(encrypted, 'binary'),
    );
    expect(decrypted?.toString()).toBe('abc');
  });
  testUtils.testIf(
    testUtils.isTestPlatformEmpty || testUtils.isTestPlatformDocker,
  )('encrypts data fails with invalid JWK file', async () => {
    const dataPath = path.join(agentDir, 'data');
    const jwkPath = path.join(agentDir, 'jwk');
    await fs.promises.writeFile(dataPath, 'abc', {
      encoding: 'binary',
    });
    const { exitCode } = await testUtils.pkExec(
      ['keys', 'encrypt', dataPath, jwkPath, '--format', 'json'],
      {
        env: {
          PK_NODE_PATH: agentDir,
          PK_PASSWORD: agentPassword,
        },
        cwd: agentDir,
        command: globalThis.testCmd,
      },
    );
    expect(exitCode).toBe(sysexits.NOINPUT);
  });
});
