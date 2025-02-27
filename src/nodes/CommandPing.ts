import type PolykeyClient from 'polykey/dist/PolykeyClient';
import type { NodeId } from 'polykey/dist/ids/types';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils';
import * as binOptions from '../utils/options';
import * as binProcessors from '../utils/processors';
import * as binParsers from '../utils/parsers';
import * as errors from '../errors';

class CommandPing extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('ping');
    this.description("Ping a Node to check if it's Online");
    this.argument('<nodeId>', 'Id of the node to ping', binParsers.parseNodeId);
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (nodeId: NodeId, options) => {
      const { default: PolykeyClient } = await import(
        'polykey/dist/PolykeyClient'
      );
      const nodesUtils = await import('polykey/dist/nodes/utils');
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

      let pkClient: PolykeyClient;
      this.exitHandlers.handlers.push(async () => {
        if (pkClient != null) await pkClient.stop();
      });
      try {
        pkClient = await PolykeyClient.createPolykeyClient({
          nodeId: clientOptions.nodeId,
          host: clientOptions.clientHost,
          port: clientOptions.clientPort,
          options: {
            nodePath: options.nodePath,
          },
          logger: this.logger.getChild(PolykeyClient.name),
        });
        let error;
        const statusMessage = await binUtils.retryAuthentication(
          (auth) =>
            pkClient.rpcClient.methods.nodesPing({
              metadata: auth,
              nodeIdEncoded: nodesUtils.encodeNodeId(nodeId),
            }),
          auth,
        );
        const status = { success: false, message: '' };
        status.success = statusMessage ? statusMessage.success : false;
        if (!status.success && !error) {
          error = new errors.ErrorPolykeyCLINodePingFailed(
            'No response received',
          );
        }
        if (status.success) status.message = 'Node is Active.';
        else status.message = error.message;
        const output: any =
          options.format === 'json' ? status : [status.message];
        const outputFormatted = binUtils.outputFormatter({
          type: options.format === 'json' ? 'json' : 'list',
          data: output,
        });
        process.stdout.write(outputFormatted);

        if (error != null) throw error;
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandPing;
