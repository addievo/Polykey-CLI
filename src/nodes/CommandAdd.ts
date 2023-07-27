import type PolykeyClient from '@matrixai/polykey/dist/PolykeyClient';
import type WebSocketClient from '@matrixai/polykey/dist/websockets/WebSocketClient';
import type { NodeId } from '@matrixai/polykey/dist/ids/types';
import type { Host, Port } from '@matrixai/polykey/dist/network/types';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils/utils';
import * as binProcessors from '../utils/processors';
import * as binOptions from '../utils/options';
import * as binParsers from '../utils/parsers';

class CommandAdd extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('add');
    this.description('Add a Node to the Node Graph');
    this.argument('<nodeId>', 'Id of the node to add', binParsers.parseNodeId);
    this.argument('<host>', 'Address of the node', binParsers.parseHost);
    this.argument('<port>', 'Port of the node', binParsers.parsePort);
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.addOption(binOptions.forceNodeAdd);
    this.addOption(binOptions.noPing);
    this.action(async (nodeId: NodeId, host: Host, port: Port, options) => {
      const { default: PolykeyClient } = await import(
        '@matrixai/polykey/dist/PolykeyClient'
      );
      const { default: WebSocketClient } = await import(
        '@matrixai/polykey/dist/websockets/WebSocketClient'
      );
      const nodesUtils = await import('@matrixai/polykey/dist/nodes/utils');
      const clientOptions = await binProcessors.processClientOptions(
        options.nodePath,
        options.nodeId,
        options.clientHost,
        options.clientPort,
        this.fs,
        this.logger.getChild(binProcessors.processClientOptions.name),
      );
      const auth = await binProcessors.processAuthentication(
        options.passwordFile,
        this.fs,
      );
      let webSocketClient: WebSocketClient;
      let pkClient: PolykeyClient;
      this.exitHandlers.handlers.push(async () => {
        if (pkClient != null) await pkClient.stop();
        if (webSocketClient != null) await webSocketClient.destroy(true);
      });
      try {
        webSocketClient = await WebSocketClient.createWebSocketClient({
          expectedNodeIds: [clientOptions.nodeId],
          host: clientOptions.clientHost,
          port: clientOptions.clientPort,
          logger: this.logger.getChild(WebSocketClient.name),
        });
        pkClient = await PolykeyClient.createPolykeyClient({
          streamFactory: (ctx) => webSocketClient.startConnection(ctx),
          nodePath: options.nodePath,
          logger: this.logger.getChild(PolykeyClient.name),
        });
        await binUtils.retryAuthentication(
          (auth) =>
            pkClient.rpcClientClient.methods.nodesAdd({
              metadata: auth,
              nodeIdEncoded: nodesUtils.encodeNodeId(nodeId),
              host: host,
              port: port,
              force: options.force,
              ping: options.ping,
            }),
          auth,
        );
      } finally {
        if (pkClient! != null) await pkClient.stop();
        if (webSocketClient! != null) await webSocketClient.destroy();
      }
    });
  }
}

export default CommandAdd;
