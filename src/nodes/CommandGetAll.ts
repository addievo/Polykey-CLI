import type PolykeyClient from 'polykey/dist/PolykeyClient';
import type { NodesGetMessage } from 'polykey/dist/client/types';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils';
import * as binOptions from '../utils/options';
import * as binProcessors from '../utils/processors';

class CommandGetAll extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('getall');
    this.description('Get all Nodes from Node Graph');
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (options) => {
      const { default: PolykeyClient } = await import(
        'polykey/dist/PolykeyClient'
      );
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
        const resultOutput = await binUtils.retryAuthentication(
          async (auth) => {
            const result = await pkClient.rpcClient.methods.nodesGetAll({
              metadata: auth,
            });
            const output: Array<NodesGetMessage> = [];
            for await (const nodesGetMessage of result) {
              output.push(nodesGetMessage);
            }
            return output;
          },
          auth,
        );
        let output: Array<any> = [];
        if (options.format === 'human') {
          for (const nodesGetMessage of resultOutput) {
            const nodeIdEncoded = nodesGetMessage.nodeIdEncoded;
            const bucketIndex = nodesGetMessage.bucketIndex;
            for (const address of Object.keys(nodesGetMessage.nodeContact)) {
              output.push(
                `NodeId ${nodeIdEncoded}, Address ${address}, bucketIndex ${bucketIndex}`,
              );
            }
          }
        } else {
          output = resultOutput;
        }
        const outputFormatted = binUtils.outputFormatter({
          type: options.format === 'json' ? 'json' : 'list',
          data: output,
        });
        process.stdout.write(outputFormatted);
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandGetAll;
