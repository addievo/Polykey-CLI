import type { NodeIdEncoded } from 'polykey/dist/nodes/types';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import Logger, { LogLevel, StreamHandler, formatting } from '@matrixai/logger';
import PolykeyAgent from 'polykey/dist/PolykeyAgent';
import config from 'polykey/dist/config';
import { sleep } from 'polykey/dist/utils';
import * as keysUtils from 'polykey/dist/keys/utils';
import * as testUtils from '../../utils';

test('dummy test', async () => {});

describe.skip('testnet connection', () => {
  const logger = new Logger('TCT', LogLevel.WARN, [new StreamHandler()]);
  const format = formatting.format`${formatting.keys}:${formatting.msg}`;
  logger.handlers.forEach((handler) => handler.setFormatter(format));
  const seedNodes = Object.entries(config.network.testnet);
  const seedNodeId1 = seedNodes[0][0] as NodeIdEncoded;
  const _seedNodeAddress1 = seedNodes[0][1];
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await fs.promises.mkdtemp(
      path.join(globalThis.tmpDir, 'polykey-test-'),
    );
  });
  afterEach(async () => {
    await fs.promises.rm(dataDir, {
      force: true,
      recursive: true,
    });
  });
  test('can connect to `testnet.polykey.io` seed node', async () => {
    const password = 'abc123';
    const nodePath = path.join(dataDir, 'polykey');
    // Starting an agent with the testnet as a seed node
    const agentProcess = await testUtils.pkSpawn(
      [
        'agent',
        'start',
        '--network',
        'testnet',
        '--format',
        'json',
        '--verbose',
        '--workers',
        '0',
      ],
      {
        env: {
          PK_NODE_PATH: nodePath,
          PK_PASSWORD: password,
        },
        cwd: dataDir,
      },
      logger,
    );
    try {
      const rlOut = readline.createInterface(agentProcess.stdout!);
      await new Promise<string>((resolve, reject) => {
        rlOut.once('line', resolve);
        rlOut.once('close', reject);
      });

      // Pinging the seed node
      const { exitCode: exitCode1 } = await testUtils.pkStdio(
        ['nodes', 'ping', seedNodeId1, '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode1).toBe(0);
    } finally {
      agentProcess.kill('SIGINT');
      await testUtils.processExit(agentProcess);
    }
  });
  test('network expands when connecting to seed node', async () => {
    const password = 'abc123';
    // Starting two nodes with the testnet as the seed node
    const nodePathA = path.join(dataDir, 'polykeyA');
    const nodePathB = path.join(dataDir, 'polykeyB');
    const agentProcessA = await testUtils.pkSpawn(
      [
        'agent',
        'start',
        '--network',
        'testnet',
        '--format',
        'json',
        '--verbose',
        '--workers',
        '0',
      ],
      {
        env: {
          PK_NODE_PATH: nodePathA,
          PK_PASSWORD: password,
        },
        cwd: dataDir,
      },
      logger,
    );
    const agentProcessB = await testUtils.pkSpawn(
      [
        'agent',
        'start',
        '--network',
        'testnet',
        '--format',
        'json',
        '--verbose',
        '--workers',
        '0',
      ],
      {
        env: {
          PK_NODE_PATH: nodePathB,
          PK_PASSWORD: password,
        },
        cwd: dataDir,
      },
      logger,
    );

    try {
      const rlOutA = readline.createInterface(agentProcessA.stdout!);
      const stdoutA = await new Promise<string>((resolve, reject) => {
        rlOutA.once('line', resolve);
        rlOutA.once('close', reject);
      });
      const statusLiveDataA = JSON.parse(stdoutA);
      const nodeIdA = statusLiveDataA.nodeId;

      const rlOutB = readline.createInterface(agentProcessB.stdout!);
      const stdoutB = await new Promise<string>((resolve, reject) => {
        rlOutB.once('line', resolve);
        rlOutB.once('close', reject);
      });
      const statusLiveDataB = JSON.parse(stdoutB);
      const nodeIdB = statusLiveDataB.nodeId;

      // NodeA should ping the seed node
      const { exitCode: exitCode1 } = await testUtils.pkStdio(
        ['nodes', 'ping', seedNodeId1, '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePathA,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode1).toBe(0);

      // NodeB should ping the seed node
      const { exitCode: exitCode2 } = await testUtils.pkStdio(
        ['nodes', 'ping', seedNodeId1, '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePathB,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode2).toBe(0);

      // NodeA should be able to ping to NodeB
      const { exitCode: exitCode3 } = await testUtils.pkStdio(
        ['nodes', 'ping', nodeIdB, '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePathA,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode3).toBe(0);

      // NodeB should be able to ping to NodeA
      const { exitCode: exitCode4 } = await testUtils.pkStdio(
        ['nodes', 'ping', nodeIdA, '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePathB,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode4).toBe(0);
    } finally {
      agentProcessA.kill('SIGINT');
      agentProcessB.kill('SIGINT');
      await testUtils.processExit(agentProcessA);
      await testUtils.processExit(agentProcessB);
    }
  });
  // This test is known to fail, two nodes on the same network can't hole punch
  test.skip('testing hole punching', async () => {
    // Const nodePathS = path.join(dataDir, 'seed');
    const nodePath1 = path.join(dataDir, 'node1');
    const nodePath2 = path.join(dataDir, 'node2');
    const password = 'password';
    const localhost = '127.0.0.1';
    logger.setLevel(LogLevel.WARN);
    // Console.log('Starting Seed');
    // const seed = await PolykeyAgent.createPolykeyAgent({
    //   password,
    //   nodePath: nodePathS,
    //   networkConfig: {
    //     proxyHost: localhost,
    //     agentHost: localhost,
    //     clientHost: localhost,
    //     forwardHost: localhost,
    //     proxyPort: 55550,
    //   },
    //   keysConfig: {
    //     privateKeyPemOverride: globalRootKeyPems[0],
    //   },
    //   logger: logger.getChild('S'),
    // });
    // const seedNodes: SeedNodes = {
    //   [nodesUtils.encodeNodeId(seed.keyManager.getNodeId())]: {
    //     host: seed.proxy.getProxyHost(),
    //     port: seed.proxy.getProxyPort(),
    //   },
    // };
    // const seedNodes: SeedNodes = {
    //   [seedNodeId1]: seedNodeAddress1,
    // };
    // Console.log('Starting Agent1');
    const agent1 = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath: nodePath1,
        seedNodes,
        agentServiceHost: localhost,
        clientServiceHost: localhost,
        agentServicePort: 55551,
        keys: {
          passwordOpsLimit: keysUtils.passwordOpsLimits.min,
          passwordMemLimit: keysUtils.passwordMemLimits.min,
          strictMemoryLock: false,
        },
      },
      logger: logger.getChild('A1'),
    });
    // Console.log('Starting Agent2');
    logger.setLevel(LogLevel.WARN);
    const agent2 = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath: nodePath2,
        seedNodes,
        agentServiceHost: localhost,
        clientServiceHost: localhost,
        agentServicePort: 55552,
        keys: {
          passwordOpsLimit: keysUtils.passwordOpsLimits.min,
          passwordMemLimit: keysUtils.passwordMemLimits.min,
          strictMemoryLock: false,
        },
      },
      logger: logger.getChild('A2'),
    });
    try {
      logger.setLevel(LogLevel.WARN);
      // Console.log('syncing 1');
      // await agent1.nodeManager.syncNodeGraph(true);
      // console.log('syncing 2');
      // await agent2.nodeManager.syncNodeGraph(true);

      // seed   hun0
      // agent1 ijtg
      // agent2 fhmg

      // Ping the node
      await sleep(5000);
      // Console.log(
      //   nodesUtils.encodeNodeId(agent1.keyManager.getNodeId()),
      //   agent1.proxy.getProxyHost(),
      //   agent1.proxy.getProxyPort(),
      // );
      // console.log(
      //   nodesUtils.encodeNodeId(agent2.keyManager.getNodeId()),
      //   agent2.proxy.getProxyHost(),
      //   agent2.proxy.getProxyPort(),
      // );
      // console.log('Attempting ping');
      const pingResult = await agent2.nodeManager.pingNode(
        agent1.keyRing.getNodeId(),
      );
      // Console.log(pingResult);
      expect(pingResult).toBe(true);
    } finally {
      logger.setLevel(LogLevel.WARN);
      // Console.log('cleaning up');
      // Await seed.stop();
      await agent1.stop();
      await agent2.stop();
    }
  });

  // We want to ping each other
});
