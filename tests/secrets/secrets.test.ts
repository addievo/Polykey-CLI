import type { VaultName } from 'polykey/dist/vaults/types';
import path from 'path';
import fs from 'fs';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import PolykeyAgent from 'polykey/dist/PolykeyAgent';
import { vaultOps } from 'polykey/dist/vaults';
import * as keysUtils from 'polykey/dist/keys/utils';
import * as testUtils from '../utils';

describe('CLI secrets', () => {
  const password = 'password';
  const logger = new Logger('CLI Test', LogLevel.WARN, [new StreamHandler()]);
  let dataDir: string;
  let polykeyAgent: PolykeyAgent;
  let passwordFile: string;
  let command: Array<string>;

  beforeEach(async () => {
    dataDir = await fs.promises.mkdtemp(
      path.join(globalThis.tmpDir, 'polykey-test-'),
    );
    passwordFile = path.join(dataDir, 'passwordFile');
    await fs.promises.writeFile(passwordFile, 'password');
    polykeyAgent = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath: dataDir,
        agentServiceHost: '127.0.0.1',
        clientServiceHost: '127.0.0.1',
        keys: {
          passwordOpsLimit: keysUtils.passwordOpsLimits.min,
          passwordMemLimit: keysUtils.passwordMemLimits.min,
          strictMemoryLock: false,
        },
      },
      logger: logger,
    });
    // Authorize session
    await testUtils.pkStdio(
      ['agent', 'unlock', '-np', dataDir, '--password-file', passwordFile],
      {
        env: {},
        cwd: dataDir,
      },
    );
  });
  afterEach(async () => {
    await polykeyAgent.stop();
    await fs.promises.rm(dataDir, {
      force: true,
      recursive: true,
    });
  });

  describe('commandCreateSecret', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should create secrets',
      async () => {
        const vaultName = 'Vault1' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);
        const secretPath = path.join(dataDir, 'secret');
        await fs.promises.writeFile(secretPath, 'this is a secret');

        command = [
          'secrets',
          'create',
          '-np',
          dataDir,
          secretPath,
          `${vaultName}:MySecret`,
        ];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.exitCode).toBe(0);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual(['MySecret']);
          expect(
            (await vaultOps.getSecret(vault, 'MySecret')).toString(),
          ).toStrictEqual('this is a secret');
        });
      },
      globalThis.defaultTimeout * 2,
    );
  });
  describe('commandDeleteSecret', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should delete secrets',
      async () => {
        const vaultName = 'Vault2' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(vault, 'MySecret', 'this is the secret');
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual(['MySecret']);
        });

        command = [
          'secrets',
          'delete',
          '-np',
          dataDir,
          `${vaultName}:MySecret`,
        ];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.exitCode).toBe(0);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual([]);
        });
      },
    );
  });
  describe('commandGetSecret', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should retrieve secrets',
      async () => {
        const vaultName = 'Vault3' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(vault, 'MySecret', 'this is the secret');
        });

        command = ['secrets', 'get', '-np', dataDir, `${vaultName}:MySecret`];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.stdout).toBe('this is the secret');
        expect(result.exitCode).toBe(0);
      },
    );
  });
  describe('commandListSecrets', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should list secrets',
      async () => {
        const vaultName = 'Vault4' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(vault, 'MySecret1', 'this is the secret 1');
          await vaultOps.addSecret(vault, 'MySecret2', 'this is the secret 2');
          await vaultOps.addSecret(vault, 'MySecret3', 'this is the secret 3');
        });

        command = ['secrets', 'list', '-np', dataDir, vaultName];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.exitCode).toBe(0);
      },
      globalThis.defaultTimeout * 2,
    );
  });
  describe('commandNewDir', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should make a directory',
      async () => {
        const vaultName = 'Vault5' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        command = [
          'secrets',
          'mkdir',
          '-np',
          dataDir,
          `${vaultName}:dir1/dir2`,
          '-r',
        ];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.exitCode).toBe(0);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(
            vault,
            'dir1/MySecret1',
            'this is the secret 1',
          );
          await vaultOps.addSecret(
            vault,
            'dir1/dir2/MySecret2',
            'this is the secret 2',
          );

          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual(
            ['dir1/MySecret1', 'dir1/dir2/MySecret2'].sort(),
          );
        });
      },
    );
  });
  describe('commandRenameSecret', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should rename secrets',
      async () => {
        const vaultName = 'Vault6' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(vault, 'MySecret', 'this is the secret');
        });

        command = [
          'secrets',
          'rename',
          '-np',
          dataDir,
          `${vaultName}:MySecret`,
          'MyRenamedSecret',
        ];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.exitCode).toBe(0);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual(['MyRenamedSecret']);
        });
      },
    );
  });
  describe('commandUpdateSecret', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should update secrets',
      async () => {
        const vaultName = 'Vault7' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        const secretPath = path.join(dataDir, 'secret');
        await fs.promises.writeFile(secretPath, 'updated-content');

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(vault, 'MySecret', 'original-content');
          expect(
            (await vaultOps.getSecret(vault, 'MySecret')).toString(),
          ).toStrictEqual('original-content');
        });

        command = [
          'secrets',
          'update',
          '-np',
          dataDir,
          secretPath,
          `${vaultName}:MySecret`,
        ];

        const result2 = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result2.exitCode).toBe(0);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual(['MySecret']);
          expect(
            (await vaultOps.getSecret(vault, 'MySecret')).toString(),
          ).toStrictEqual('updated-content');
        });
      },
    );
  });
  describe('commandNewDirSecret', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should add a directory of secrets',
      async () => {
        const vaultName = 'Vault8' as VaultName;
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        const secretDir = path.join(dataDir, 'secrets');
        await fs.promises.mkdir(secretDir);
        await fs.promises.writeFile(
          path.join(secretDir, 'secret-1'),
          'this is the secret 1',
        );
        await fs.promises.writeFile(
          path.join(secretDir, 'secret-2'),
          'this is the secret 2',
        );
        await fs.promises.writeFile(
          path.join(secretDir, 'secret-3'),
          'this is the secret 3',
        );

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual([]);
        });

        command = ['secrets', 'dir', '-np', dataDir, secretDir, vaultName];

        const result2 = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result2.exitCode).toBe(0);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          const list = await vaultOps.listSecrets(vault);
          expect(list.sort()).toStrictEqual([
            'secrets/secret-1',
            'secrets/secret-2',
            'secrets/secret-3',
          ]);
        });
      },
    );
  });
  describe('commandStat', () => {
    testUtils.testIf(testUtils.isTestPlatformEmpty)(
      'should retrieve secrets',
      async () => {
        const vaultName = 'Vault9';
        const vaultId = await polykeyAgent.vaultManager.createVault(vaultName);

        await polykeyAgent.vaultManager.withVaults([vaultId], async (vault) => {
          await vaultOps.addSecret(vault, 'MySecret', 'this is the secret');
        });

        command = ['secrets', 'stat', '-np', dataDir, `${vaultName}:MySecret`];

        const result = await testUtils.pkStdio([...command], {
          env: {},
          cwd: dataDir,
        });
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('nlink: 1');
        expect(result.stdout).toContain('blocks: 1');
        expect(result.stdout).toContain('blksize: 4096');
        expect(result.stdout).toContain('size: 18');
      },
    );
  });
});
