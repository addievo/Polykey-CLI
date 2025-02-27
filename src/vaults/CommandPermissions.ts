import type PolykeyClient from 'polykey/dist/PolykeyClient';
import * as binProcessors from '../utils/processors';
import * as binUtils from '../utils';
import CommandPolykey from '../CommandPolykey';
import * as binOptions from '../utils/options';

class CommandPermissions extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('permissions');
    this.alias('perms');
    this.description('Sets the permissions of a vault for Node Ids');
    this.argument('<vaultName>', 'Name or ID of the vault');
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (vaultName, options) => {
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
        const data: Array<string> = [];
        await binUtils.retryAuthentication(async (auth) => {
          const permissionStream =
            await pkClient.rpcClient.methods.vaultsPermissionGet({
              metadata: auth,
              nameOrId: vaultName,
            });
          for await (const permission of permissionStream) {
            const nodeId = permission.nodeIdEncoded;
            const actions = permission.vaultPermissionList.join(', ');
            data.push(`${nodeId}: ${actions}`);
          }
          return true;
        }, meta);

        if (data.length === 0) data.push('No permissions were found');
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

export default CommandPermissions;
