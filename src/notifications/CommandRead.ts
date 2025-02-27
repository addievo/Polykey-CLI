import type { Notification } from 'polykey/dist/notifications/types';
import type PolykeyClient from 'polykey/dist/PolykeyClient';
import CommandPolykey from '../CommandPolykey';
import * as binUtils from '../utils';
import * as binOptions from '../utils/options';
import * as binProcessors from '../utils/processors';

class CommandRead extends CommandPolykey {
  constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
    super(...args);
    this.name('read');
    this.description('Display Notifications');
    this.option(
      '-u, --unread',
      '(optional) Flag to only display unread notifications',
    );
    this.option(
      '-n, --number [number]',
      '(optional) Number of notifications to read',
      'all',
    );
    this.option(
      '-o, --order [order]',
      '(optional) Order to read notifications',
      'newest',
    );
    this.addOption(binOptions.nodeId);
    this.addOption(binOptions.clientHost);
    this.addOption(binOptions.clientPort);
    this.action(async (options) => {
      const { default: PolykeyClient } = await import(
        'polykey/dist/PolykeyClient'
      );
      const notificationsUtils = await import(
        'polykey/dist/notifications/utils'
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
        const response = await binUtils.retryAuthentication(
          (auth) =>
            pkClient.rpcClient.methods.notificationsRead({
              metadata: auth,
              unread: options.unread,
              number: options.number,
              order: options.order,
            }),
          meta,
        );
        const notifications: Array<Notification> = [];
        for await (const notificationMessage of response) {
          const notification = notificationsUtils.parseNotification(
            notificationMessage.notification,
          );
          notifications.push(notification);
        }
        for (const notification of notifications) {
          const outputFormatted = binUtils.outputFormatter({
            type: options.format === 'json' ? 'json' : 'dict',
            data: notification,
          });
          process.stdout.write(outputFormatted);
        }
      } finally {
        if (pkClient! != null) await pkClient.stop();
      }
    });
  }
}

export default CommandRead;
