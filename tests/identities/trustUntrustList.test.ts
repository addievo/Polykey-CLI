import type { Host, Port } from 'polykey/dist/network/types';
import type { IdentityId, ProviderId } from 'polykey/dist/identities/types';
import type { NodeId } from 'polykey/dist/ids/types';
import type { ClaimLinkIdentity } from 'polykey/dist/claims/payloads';
import type { SignedClaim } from 'polykey/dist/claims/types';
import path from 'path';
import fs from 'fs';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import PolykeyAgent from 'polykey/dist/PolykeyAgent';
import { sysexits } from 'polykey/dist/utils';
import * as nodesUtils from 'polykey/dist/nodes/utils';
import * as identitiesUtils from 'polykey/dist/identities/utils';
import * as keysUtils from 'polykey/dist/keys/utils';
import { encodeProviderIdentityId } from 'polykey/dist/identities/utils';
import TestProvider from '../TestProvider';
import * as testUtils from '../utils';

// @ts-ignore: stub out method
identitiesUtils.browser = () => {};

describe('trust/untrust/list', () => {
  const logger = new Logger('trust/untrust/list test', LogLevel.WARN, [
    new StreamHandler(),
  ]);
  const password = 'password';
  const identity = 'abc' as IdentityId;
  const testToken = {
    providerId: 'test-provider' as ProviderId,
    identityId: 'test_user' as IdentityId,
  };
  let provider: TestProvider;
  let providerString: string;
  let dataDir: string;
  let nodePath: string;
  let pkAgent: PolykeyAgent;
  let node: PolykeyAgent;
  let nodeId: NodeId;
  let nodeHost: Host;
  let nodePort: Port;
  beforeEach(async () => {
    provider = new TestProvider();
    providerString = `${provider.id}:${identity}`;
    dataDir = await fs.promises.mkdtemp(
      path.join(globalThis.tmpDir, 'polykey-test-'),
    );
    nodePath = path.join(dataDir, 'polykey');
    pkAgent = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath,
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
    pkAgent.identitiesManager.registerProvider(provider);
    // Set up a gestalt to trust
    const nodePathGestalt = path.join(dataDir, 'gestalt');
    node = await PolykeyAgent.createPolykeyAgent({
      password,
      options: {
        nodePath: nodePathGestalt,
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
    nodeId = node.keyRing.getNodeId();
    nodeHost = node.agentServiceHost;
    nodePort = node.agentServicePort;
    node.identitiesManager.registerProvider(provider);
    await node.identitiesManager.putToken(provider.id, identity, {
      accessToken: 'def456',
    });
    provider.users[identity] = {};
    const identityClaim = {
      typ: 'ClaimLinkIdentity',
      iss: nodesUtils.encodeNodeId(node.keyRing.getNodeId()),
      sub: encodeProviderIdentityId([provider.id, identity]),
    };
    const [, claim] = await node.sigchain.addClaim(identityClaim);
    await provider.publishClaim(
      identity,
      claim as SignedClaim<ClaimLinkIdentity>,
    );
  });
  afterEach(async () => {
    await node.stop();
    await pkAgent.stop();
    await fs.promises.rm(dataDir, {
      force: true,
      recursive: true,
    });
  });
  testUtils.testIf(testUtils.isTestPlatformEmpty)(
    'trusts and untrusts a gestalt by node, adds it to the gestalt graph, and lists the gestalt with notify permission',
    async () => {
      let exitCode, stdout;
      // Add the node to our node graph and authenticate an identity on the
      // provider
      // This allows us to contact the members of the gestalt we want to trust
      await testUtils.pkStdio(
        [
          'nodes',
          'add',
          nodesUtils.encodeNodeId(nodeId),
          nodeHost,
          `${nodePort}`,
        ],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      await testUtils.pkStdio(
        [
          'identities',
          'authenticate',
          testToken.providerId,
          testToken.identityId,
        ],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      // Trust node - this should trigger discovery on the gestalt the node
      // belongs to and add it to our gestalt graph
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'trust', nodesUtils.encodeNodeId(nodeId)],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      // Since discovery is a background process we need to wait for the
      // gestalt to be discovered
      let existingTasks: number = 0;
      do {
        existingTasks = await pkAgent.discovery.waitForDiscoveryTasks();
      } while (existingTasks > 0);
      // Check that gestalt was discovered and permission was set
      ({ exitCode, stdout } = await testUtils.pkStdio(
        ['identities', 'list', '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toHaveLength(2);
      expect(JSON.parse(stdout)[0]).toEqual({
        permissions: ['notify'],
        nodes: [{ nodeId: nodesUtils.encodeNodeId(nodeId) }],
        identities: [
          {
            providerId: provider.id,
            identityId: identity,
          },
        ],
      });
      // Untrust the gestalt by node
      // This should remove the permission, but not the gestalt (from the gestalt
      // graph)
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'untrust', nodesUtils.encodeNodeId(nodeId)],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      // Check that gestalt still exists but has no permissions
      ({ exitCode, stdout } = await testUtils.pkStdio(
        ['identities', 'list', '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toHaveLength(2);
      expect(JSON.parse(stdout)[0]).toEqual({
        permissions: null,
        nodes: [{ nodeId: nodesUtils.encodeNodeId(nodeId) }],
        identities: [
          {
            providerId: provider.id,
            identityId: identity,
          },
        ],
      });
      // Revert side-effects
      await pkAgent.gestaltGraph.unsetNode(nodeId);
      await pkAgent.gestaltGraph.unsetIdentity([provider.id, identity]);
      await pkAgent.nodeGraph.unsetNodeContact(nodeId);
      await pkAgent.identitiesManager.delToken(
        testToken.providerId,
        testToken.identityId,
      );
      // @ts-ignore - get protected property
      pkAgent.discovery.visitedVertices.clear();
    },
    globalThis.defaultTimeout * 2,
  );
  testUtils.testIf(testUtils.isTestPlatformEmpty)(
    'trusts and untrusts a gestalt by identity, adds it to the gestalt graph, and lists the gestalt with notify permission',
    async () => {
      let exitCode, stdout;
      // Add the node to our node graph and authenticate an identity on the
      // provider
      // This allows us to contact the members of the gestalt we want to trust
      await testUtils.pkStdio(
        [
          'nodes',
          'add',
          nodesUtils.encodeNodeId(nodeId),
          nodeHost,
          `${nodePort}`,
        ],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      await testUtils.pkStdio(
        [
          'identities',
          'authenticate',
          testToken.providerId,
          testToken.identityId,
        ],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      );
      // Trust identity - this should trigger discovery on the gestalt the node
      // belongs to and add it to our gestalt graph
      // This command should fail first time as we need to allow time for the
      // identity to be linked to a node in the node graph
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'trust', providerString],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(sysexits.NOUSER);
      // Since discovery is a background process we need to wait for the
      // gestalt to be discovered
      let existingTasks: number = 0;
      do {
        existingTasks = await pkAgent.discovery.waitForDiscoveryTasks();
      } while (existingTasks > 0);
      // This time the command should succeed
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'trust', providerString],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      // Check that gestalt was discovered and permission was set
      ({ exitCode, stdout } = await testUtils.pkStdio(
        ['identities', 'list', '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toHaveLength(2);
      expect(JSON.parse(stdout)[0]).toEqual({
        permissions: ['notify'],
        nodes: [{ nodeId: nodesUtils.encodeNodeId(nodeId) }],
        identities: [
          {
            providerId: provider.id,
            identityId: identity,
          },
        ],
      });
      // Untrust the gestalt by node
      // This should remove the permission, but not the gestalt (from the gestalt
      // graph)
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'untrust', providerString],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      // Check that gestalt still exists but has no permissions
      ({ exitCode, stdout } = await testUtils.pkStdio(
        ['identities', 'list', '--format', 'json'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toHaveLength(2);
      expect(JSON.parse(stdout)[0]).toEqual({
        permissions: null,
        nodes: [{ nodeId: nodesUtils.encodeNodeId(nodeId) }],
        identities: [
          {
            providerId: provider.id,
            identityId: identity,
          },
        ],
      });
      // Revert side-effects
      await pkAgent.gestaltGraph.unsetNode(nodeId);
      await pkAgent.gestaltGraph.unsetIdentity([provider.id, identity]);
      await pkAgent.nodeGraph.unsetNodeContact(nodeId);
      await pkAgent.identitiesManager.delToken(
        testToken.providerId,
        testToken.identityId,
      );
      // @ts-ignore - get protected property
      pkAgent.discovery.visitedVertices.clear();
    },
    globalThis.defaultTimeout * 2,
  );
  testUtils.testIf(testUtils.isTestPlatformEmpty)(
    'should fail on invalid inputs',
    async () => {
      let exitCode;
      // Trust
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'trust', 'invalid'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(sysexits.USAGE);
      // Untrust
      ({ exitCode } = await testUtils.pkStdio(
        ['identities', 'untrust', 'invalid'],
        {
          env: {
            PK_NODE_PATH: nodePath,
            PK_PASSWORD: password,
          },
          cwd: dataDir,
        },
      ));
      expect(exitCode).toBe(sysexits.USAGE);
    },
  );
});
