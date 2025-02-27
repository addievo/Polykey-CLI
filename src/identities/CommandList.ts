import type PolykeyClient from 'polykey/dist/PolykeyClient';
import CommandPolykey from '../CommandPolykey';
import * as binOptions from '../utils/options';
import * as binUtils from '../utils';
import * as binProcessors from '../utils/processors';

class CommandList extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('list');
    this.description('List all the Gestalts in the Gestalt Graph');
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
        let output: any;
        const gestalts = await binUtils.retryAuthentication(async (auth) => {
          const gestalts: Array<any> = [];
          const stream = await pkClient.rpcClient.methods.gestaltsGestaltList({
            metadata: auth,
          });
          for await (const gestaltMessage of stream) {
            const gestalt = gestaltMessage.gestalt;
            const newGestalt: any = {
              permissions: [],
              nodes: [],
              identities: [],
            };
            for (const node of Object.keys(gestalt.nodes)) {
              const nodeInfo = gestalt.nodes[node];
              newGestalt.nodes.push({ nodeId: nodeInfo.nodeId });
            }
            for (const identity of Object.keys(gestalt.identities)) {
              const identityInfo = gestalt.identities[identity];
              newGestalt.identities.push({
                providerId: identityInfo.providerId,
                identityId: identityInfo.identityId,
              });
            }
            // Getting the permissions for the gestalt.
            const actionsMessage = await binUtils.retryAuthentication(
              (auth) =>
                pkClient.rpcClient.methods.gestaltsActionsGetByNode({
                  metadata: auth,
                  nodeIdEncoded: newGestalt.nodes[0].nodeId,
                }),
              auth,
            );
            const actionList = actionsMessage.actionsList;
            if (actionList.length === 0) newGestalt.permissions = null;
            else newGestalt.permissions = actionList;
            gestalts.push(newGestalt);
          }
          return gestalts;
        }, auth);
        output = gestalts;
        if (options.format !== 'json') {
          // Convert to a human-readable list.
          output = [];
          let count = 1;
          for (const gestalt of gestalts) {
            output.push(`gestalt ${count}`);
            output.push(`permissions: ${gestalt.permissions ?? 'None'}`);
            // Listing nodes
            for (const node of gestalt.nodes) {
              output.push(`${node.nodeId}`);
            }
            // Listing identities
            for (const identity of gestalt.identities) {
              output.push(`${identity.providerId}:${identity.identityId}`);
            }
            output.push('');
            count++;
          }
        }
        process.stdout.write(
          binUtils.outputFormatter({
            type: options.format === 'json' ? 'json' : 'list',
            data: output,
          }),
        );
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandList;
