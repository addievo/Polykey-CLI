import type PolykeyClient from 'polykey/dist/PolykeyClient';
import process from 'process';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils';
import * as binOptions from '../utils/options';
import * as binProcessors from '../utils/processors';

class CommandLog extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('log');
    this.description('Get the Version History of a Vault');
    this.argument('<vaultName>', 'Name of the vault to obtain the log from');
    this.addOption(binOptions.commitId);
    this.addOption(binOptions.depth);
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (vault, options) => {
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
      const meta = await binProcessors.processAuthentication(
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
        const data = await binUtils.retryAuthentication(async (auth) => {
          const data: Array<string> = [];
          const logStream = await pkClient.rpcClient.methods.vaultsLog({
            metadata: auth,
            nameOrId: vault,
            depth: options.depth,
            commitId: options.commitId,
          });
          for await (const logEntryMessage of logStream) {
            data.push(`commit ${logEntryMessage.commitId}`);
            data.push(`committer ${logEntryMessage.committer}`);
            data.push(`Date: ${logEntryMessage.timestamp}`);
            data.push(`${logEntryMessage.message}`);
          }
          return data;
        }, meta);
        const outputFormatted = binUtils.outputFormatter({
          type: options.format === 'json' ? 'json' : 'list',
          data: data,
        });
        process.stdout.write(outputFormatted);
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandLog;
