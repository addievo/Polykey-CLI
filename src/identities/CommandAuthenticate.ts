import type PolykeyClient from 'polykey/dist/PolykeyClient';
import type { ClientRPCResponseResult } from 'polykey/dist/client/types';
import type { AuthProcessMessage } from 'polykey/dist/client/types';
import type { ReadableStream } from 'stream/web';
import * as identitiesUtils from 'polykey/dist/identities/utils';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils';
import * as binOptions from '../utils/options';
import * as binParsers from '../utils/parsers';
import * as binProcessors from '../utils/processors';

class CommandAuthenticate extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('authenticate');
    this.description('Authenticate a Digital Identity Provider');
    this.argument(
      '<providerId>',
      'Name of the digital identity provider',
      binParsers.parseProviderId,
    );
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (providerId, options) => {
      const { default: PolykeyClient } = await import(
        'polykey/dist/PolykeyClient'
      );
      const { never } = await import('polykey/dist/utils');
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
        let genReadable: ReadableStream<
          ClientRPCResponseResult<AuthProcessMessage>
        >;
        await binUtils.retryAuthentication(async (auth) => {
          genReadable = await pkClient.rpcClient.methods.identitiesAuthenticate(
            {
              metadata: auth,
              providerId: providerId,
            },
          );
          for await (const message of genReadable) {
            if (message.request != null) {
              this.logger.info(`Navigate to the URL in order to authenticate`);
              this.logger.info(
                'Use any additional additional properties to complete authentication',
              );
              identitiesUtils.browser(message.request.url);
              process.stdout.write(
                binUtils.outputFormatter({
                  type: options.format === 'json' ? 'json' : 'dict',
                  data: {
                    url: message.request.url,
                    ...message.request.dataMap,
                  },
                }),
              );
            } else if (message.response != null) {
              this.logger.info(
                `Authenticated digital identity provider ${providerId}`,
              );
              process.stdout.write(
                binUtils.outputFormatter({
                  type: options.format === 'json' ? 'json' : 'list',
                  data: [message.response.identityId],
                }),
              );
            } else {
              never();
            }
          }
        }, auth);
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandAuthenticate;
