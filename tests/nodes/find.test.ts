import type { Host, Port } from 'polykey/dist/network/types';
import type { NodeId } from 'polykey/dist/ids/types';
import path from 'path';
import fs from 'fs';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import PolykeyAgent from 'polykey/dist/PolykeyAgent';
import * as nodesUtils from 'polykey/dist/nodes/utils';
import { sysexits } from 'polykey/dist/errors';
import * as keysUtils from 'polykey/dist/keys/utils';
import * as testUtils from '../utils';

describe('find', () => {
  const logger = new Logger('find test', LogLevel.WARN, [new StreamHandler()]);
  const password = 'helloworld';
  let dataDir: string;
  let nodePath: string;
  let polykeyAgent: PolykeyAgent;
  let remoteOnline: PolykeyAgent;
  let remoteOffline: PolykeyAgent;
  let remoteOnlineNodeId: NodeId;
  let _remoteOfflineNodeId: NodeId;
  let remoteOnlineHost: Host;
  let remoteOnlinePort: Port;
  let _remoteOfflineHost: Host;
  let _remoteOfflinePort: Port;
  beforeEach(async () => {
    dataDir = await fs.promises.mkdtemp(
      path.join(globalThis.tmpDir, 'polykey-test-'),
    );
    nodePath = path.join(dataDir, 'keynode');
    polykeyAgent = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        seedNodes: {}, // Explicitly no seed nodes on startup
        nodePath,
        agentServiceHost: '127.0.0.1',
        clientServiceHost: '127.0.0.1',
        keys: {
          passwordOpsLimit: keysUtils.passwordOpsLimits.min,
          passwordMemLimit: keysUtils.passwordMemLimits.min,
          strictMemoryLock: false,
        },
        nodes: {
          connectionConnectTimeoutTime: 2000,
          connectionKeepAliveIntervalTime: 500,
          connectionKeepAliveTimeoutTime: 2000,
        },
      },
      logger,
    });
    // Setting up a remote keynode
    remoteOnline = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath: path.join(dataDir, 'remoteOnline'),
        agentServiceHost: '127.0.0.1',
        clientServiceHost: '127.0.0.1',
        keys: {
          passwordOpsLimit: keysUtils.passwordOpsLimits.min,
          passwordMemLimit: keysUtils.passwordMemLimits.min,
          strictMemoryLock: false,
        },
      },
      logger,
    });
    remoteOnlineNodeId = remoteOnline.keyRing.getNodeId();
    remoteOnlineHost = remoteOnline.agentServiceHost;
    remoteOnlinePort = remoteOnline.agentServicePort;
    // Await testUtils.nodesConnect(polykeyAgent, remoteOnline);
    // Setting up an offline remote keynode
    remoteOffline = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath: path.join(dataDir, 'remoteOffline'),
        agentServiceHost: '127.0.0.1',
        clientServiceHost: '127.0.0.1',
        keys: {
          passwordOpsLimit: keysUtils.passwordOpsLimits.min,
          passwordMemLimit: keysUtils.passwordMemLimits.min,
          strictMemoryLock: false,
        },
      },
      logger,
    });
    _remoteOfflineNodeId = remoteOffline.keyRing.getNodeId();
    _remoteOfflineHost = remoteOffline.agentServiceHost;
    _remoteOfflinePort = remoteOffline.agentServicePort;
    await testUtils.nodesConnect(polykeyAgent, remoteOffline);
    await remoteOffline.stop();
  });
  afterEach(async () => {
    await polykeyAgent.stop();
    await remoteOnline.stop();
    await remoteOffline.stop();
    await fs.promises.rm(dataDir, {
      force: true,
      recursive: true,
    });
  });
  testUtils.testIf(testUtils.isTestPlatformEmpty)(
    'finds an online node',
    async () => {
      const { exitCode, stdout } = await testUtils.pkStdio(
        [
          'nodes',
          'find',
          nodesUtils.encodeNodeId(remoteOnlineNodeId),
          '--format',
          'json',
        ],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode).toBe(0);
      const output = JSON.parse(stdout);
      expect(output).toMatchObject({
        success: true,
        id: nodesUtils.encodeNodeId(remoteOnlineNodeId),
      });
      expect(output.address).toMatchObject({
        host: remoteOnlineHost,
        port: remoteOnlinePort,
      });
      expect(output.message).toMatch(
        new RegExp(
          `Found node at .*?${remoteOnlineHost}:${remoteOnlinePort}.*?`,
        ),
      );
    },
  );
  // FIXME: Bug with RPC, we can't respond after timeout since client timeout forces close.
  // disabled
  testUtils.testIf(false && testUtils.isTestPlatformEmpty)(
    'fails to find an unknown node',
    async () => {
      const unknownNodeId = nodesUtils.decodeNodeId(
        'vrcacp9vsb4ht25hds6s4lpp2abfaso0mptcfnh499n35vfcn2gkg',
      );
      const { exitCode, stdout } = await testUtils.pkStdio(
        [
          'nodes',
          'find',
          nodesUtils.encodeNodeId(unknownNodeId!),
          '--format',
          'json',
        ],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      expect(exitCode).toBe(sysexits.GENERAL);
      expect(JSON.parse(stdout)).toEqual({
        success: false,
        message: `Failed to find node ${nodesUtils.encodeNodeId(
          unknownNodeId!,
        )}`,
        id: nodesUtils.encodeNodeId(unknownNodeId!),
        address: [],
      });
    },
    globalThis.failedConnectionTimeout,
  );
});
