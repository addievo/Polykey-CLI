import type PolykeyClient from 'polykey/dist/PolykeyClient';
import type { PublicKeyJWK } from 'polykey/dist/keys/types';
import * as errors from '../errors';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils';
import * as binOptions from '../utils/options';
import * as binProcessors from '../utils/processors';

class CommandEncypt extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('encrypt');
    this.description('Encrypt a File for a target node');
    this.argument(
      '<filePath>',
      'Path to the file to encrypt, file must use binary encoding',
    );
    this.argument('<nodeIdOrJwkFile>', 'NodeId or public JWK for target node');
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (filePath, nodeIdOrJwkFile, options) => {
      const { default: PolykeyClient } = await import(
        'polykey/dist/PolykeyClient'
      );
      const nodesUtils = await import('polykey/dist/nodes/utils');
      const keysUtils = await import('polykey/dist/keys/utils');
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
        let plainText: string;
        try {
          plainText = await this.fs.promises.readFile(filePath, {
            encoding: 'binary',
          });
        } catch (e) {
          throw new errors.ErrorPolykeyCLIFileRead(e.message, {
            data: {
              errno: e.errno,
              syscall: e.syscall,
              code: e.code,
              path: e.path,
            },
            cause: e,
          });
        }
        let publicJWK: PublicKeyJWK;
        const nodeId = nodesUtils.decodeNodeId(nodeIdOrJwkFile);
        if (nodeId != null) {
          publicJWK = keysUtils.publicKeyToJWK(
            keysUtils.publicKeyFromNodeId(nodeId),
          );
        } else {
          // If it's not a NodeId then it's a file path to the JWK
          try {
            const rawJWK = await this.fs.promises.readFile(nodeIdOrJwkFile, {
              encoding: 'utf-8',
            });
            publicJWK = JSON.parse(rawJWK) as PublicKeyJWK;
            // Checking if the JWK is valid
            keysUtils.publicKeyFromJWK(publicJWK);
          } catch (e) {
            throw new errors.ErrorPolykeyCLIPublicJWKFileRead(
              'Failed to parse JWK file',
              { cause: e },
            );
          }
        }
        const response = await binUtils.retryAuthentication(
          (auth) =>
            pkClient.rpcClient.methods.keysEncrypt({
              metadata: auth,
              publicKeyJwk: publicJWK,
              data: plainText,
            }),
          auth,
        );
        const result = {
          encryptedData: response.data,
        };
        let output: any = result;
        if (options.format === 'human') {
          output = { 'Encrypted data:': result.encryptedData };
        }
        process.stdout.write(
          binUtils.outputFormatter({
            type: options.format === 'json' ? 'json' : 'dict',
            data: output,
          }),
        );
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandEncypt;
