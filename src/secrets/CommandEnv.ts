// Import { spawn } from 'child_process';
// import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
// import * as vaultsPB from 'polykey/dist/proto/js/polykey/v1/vaults/vaults_pb';
// import * as secretsPB from 'polykey/dist/proto/js/polykey/v1/secrets/secrets_pb';
// import PolykeyClient from 'polykey/dist/PolykeyClient';
// import * as utils from 'polykey/dist/utils';
// import * as binUtils from '../utils';
// import * as CLIErrors from '../errors';
// import * as grpcErrors from 'polykey/dist/grpc/errors';

// import CommandPolykey from '../CommandPolykey';
// import * as binOptions from '../utils/options';

// class CommandEnv extends CommandPolykey {
//   constructor(...args: ConstructorParameters<typeof CommandPolykey>) {
//     super(...args);
//     this.name('env');
//     this.description('Secrets Env');
//     this.option(
//       '--command <command>',
//       'In the environment of the derivation, run the shell command cmd in an interactive shell (Use --run to use a non-interactive shell instead)',
//     );
//     this.option(
//       '--run <run>',
//       'In the environment of the derivation, run the shell command cmd in a non-interactive shell, meaning (among other things) that if you hit Ctrl-C while the command is running, the shell exits (Use --command to use an interactive shell instead)',
//     );
//     this.arguments(
//       "Secrets to inject into env, of the format '<vaultName>:<secretPath>[=<variableName>]', you can also control what the environment variable will be called using '[<variableName>]' (defaults to upper, snake case of the original secret name)",
//     );
//     this.addOption(binOptions.nodeId);
//     this.addOption(binOptions.clientHost);
//     this.addOption(binOptions.clientPort);
//     this.action(async (options, command) => {

//     });
//   }
// }

// export default CommandEnv;

// OLD COMMAND
// const env = binUtils.createCommand('env', {
//   description: 'Runs a modified environment with injected secrets',
//   nodePath: true,
//   verbose: true,
//   format: true,
// });
// env.option(
//   '--command <command>',
//   'In the environment of the derivation, run the shell command cmd in an interactive shell (Use --run to use a non-interactive shell instead)',
// );
// env.option(
//   '--run <run>',
//   'In the environment of the derivation, run the shell command cmd in a non-interactive shell, meaning (among other things) that if you hit Ctrl-C while the command is running, the shell exits (Use --command to use an interactive shell instead)',
// );
// env.arguments(
//   "Secrets to inject into env, of the format '<vaultName>:<secretPath>[=<variableName>]', you can also control what the environment variable will be called using '[<variableName>]' (defaults to upper, snake case of the original secret name)",
// );
// env.action(async (options, command) => {
//   const clientConfig = {};
//   clientConfig['logger'] = new Logger('CLI Logger', LogLevel.WARN, [
//     new StreamHandler(),
//   ]);
//   if (options.verbose) {
//     clientConfig['logger'].setLevel(LogLevel.DEBUG);
//   }
//   clientConfig['nodePath'] = options.nodePath
//     ? options.nodePath
//     : utils.getDefaultNodePath();

//   const client = await PolykeyClient.createPolykeyClient(clientConfig);
//   const vaultMessage = new vaultsPB.Vault();
//   const secretMessage = new secretsPB.Secret();
//   secretMessage.setVault(vaultMessage);
//   const secretPathList: string[] = Array.from<string>(command.args.values());

//   try {
//     if (secretPathList.length < 1) {
//       throw new CLIErrors.ErrorSecretsUndefined();
//     }

//     const parsedPathList: {
//       vaultName: string;
//       secretName: string;
//       variableName: string;
//     }[] = [];

//     for (const path of secretPathList) {
//       if (!binUtils.pathRegex.test(path)) {
//         throw new CLIErrors.ErrorSecretPathFormat();
//       }

//       const [, vaultName, secretName, variableName] = path.match(
//         binUtils.pathRegex,
//       )!;
//       parsedPathList.push({
//         vaultName,
//         secretName,
//         variableName:
//           variableName ?? secretName.toUpperCase().replace('-', '_'),
//       });
//     }

//     const secretEnv = { ...process.env };

//     await client.start({});
//     const grpcClient = client.grpcClient;

//     for (const obj of parsedPathList) {
//       vaultMessage.setNameOrId(obj.vaultName);
//       secretMessage.setSecretName(obj.secretName);
//       const res = await binUtils.unaryCallCARL<secretsPB.Secret>(
//         client,
//         attemptUnaryCall(client, grpcClient.vaultsSecretsGet),
//       )(secretMessage);

//       const secret = res.getSecretName();
//       secretEnv[obj.variableName] = secret;
//     }

//     const shellPath = process.env.SHELL ?? 'sh';
//     const args: string[] = [];

//     if (options.command && options.run) {
//       throw new CLIErrors.ErrorInvalidArguments(
//         'Only one of --command or --run can be specified',
//       );
//     } else if (options.command) {
//       args.push('-i');
//       args.push('-c');
//       args.push(`"${options.command}"`);
//     } else if (options.run) {
//       args.push('-c');
//       args.push(`"${options.run}"`);
//     }

//     const shell = spawn(shellPath, args, {
//       stdio: 'inherit',
//       env: secretEnv,
//       shell: true,
//     });

//     shell.on('close', (code) => {
//       if (code !== 0) {
//         process.stdout.write(
//           binUtils.outputFormatter({
//             type: options.format === 'json' ? 'json' : 'list',
//             data: [`Terminated with ${code}`],
//           }),
//         );
//       }
//     });
//   } catch (err) {
//     if (err instanceof grpcErrors.ErrorGRPCClientTimeout) {
//       process.stderr.write(`${err.message}\n`);
//     }
//     if (err instanceof grpcErrors.ErrorGRPCServerNotStarted) {
//       process.stderr.write(`${err.message}\n`);
//     } else {
//       process.stderr.write(
//         binUtils.outputFormatter({
//           type: 'error',
//           description: err.description,
//           message: err.message,
//         }),
//       );
//       throw err;
//     }
//   } finally {
//     await client.stop();
//     options.nodePath = undefined;
//     options.verbose = undefined;
//     options.format = undefined;
//     options.command = undefined;
//     options.run = undefined;
//   }
// });

// export default env;
