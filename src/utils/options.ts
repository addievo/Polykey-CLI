/**
 * Options and Arguments used by commands
 * Use `PolykeyCommand.addOption`
 * The option parsers will parse parameters and environment variables
 * but not the default value
 * @module
 */
import commander from 'commander';
import config from 'polykey/dist/config';
import * as binParsers from '../utils/parsers';

/**
 * Node path is the path to node state
 * This is a directory on the filesystem
 * This is optional, if it is not specified, we will derive
 * platform-specific default node path
 * On unknown platforms the default is undefined
 */
const nodePath = new commander.Option(
  '-np, --node-path <path>',
  'Path to Node State',
)
  .env('PK_NODE_PATH')
  .default(config.defaultsUser.nodePath);

/**
 * Formatting choice of human, json, defaults to human
 */
const format = new commander.Option('-f, --format <format>', 'Output Format')
  .choices(['human', 'json'])
  .default('human');
/**
 * Sets log level, defaults to 0, multiple uses will increase verbosity level
 */
const verbose = new commander.Option('-v, --verbose', 'Log Verbose Messages')
  .argParser((_, p: number) => {
    return p + 1;
  })
  .default(0);

/**
 * Ignore any existing state during side-effectual construction
 */
const fresh = new commander.Option(
  '--fresh',
  'Ignore existing state during construction',
).default(false);

/**
 * Node ID used for connecting to a remote agent
 */
const nodeId = new commander.Option('-ni, --node-id <id>')
  .env('PK_NODE_ID')
  .argParser(binParsers.parseNodeId);

/**
 * Client host used for connecting to remote agent
 */
const clientHost = new commander.Option(
  '-ch, --client-host <host>',
  'Client Host Address',
)
  .env('PK_CLIENT_HOST')
  .argParser(binParsers.parseHost);

/**
 * Client port used for connecting to remote agent
 */
const clientPort = new commander.Option(
  '-cp, --client-port <port>',
  'Client Port',
)
  .env('PK_CLIENT_PORT')
  .argParser(binParsers.parsePort);

const agentHost = new commander.Option('-ah, --agent-host <host>', 'Agent host')
  .env('PK_AGENT_HOST')
  .argParser(binParsers.parseHost)
  .default(config.defaultsUser.agentServiceHost);

const agentPort = new commander.Option('-ap, --agent-port <port>', 'Agent Port')
  .env('PK_AGENT_PORT')
  .argParser(binParsers.parsePort)
  .default(config.defaultsUser.agentServicePort);

const connConnectTime = new commander.Option(
  '--connection-timeout <ms>',
  'Timeout value for connection establishment between nodes',
)
  .argParser(binParsers.parseInteger)
  .default(config.defaultsSystem.nodesConnectionConnectTimeoutTime);

const passwordFile = new commander.Option(
  '-pf, --password-file <path>',
  'Path to Password',
);

const passwordNewFile = new commander.Option(
  '-pnf, --password-new-file <path>',
  'Path to new Password',
);

const recoveryCodeFile = new commander.Option(
  '-rcf, --recovery-code-file <path>',
  'Path to Recovery Code',
);

const background = new commander.Option(
  '-b, --background',
  'Starts the agent as a background process',
);

const backgroundOutFile = new commander.Option(
  '-bof, --background-out-file <path>',
  'Path to STDOUT for agent process',
);

const backgroundErrFile = new commander.Option(
  '-bef, --background-err-file <path>',
  'Path to STDERR for agent process',
);

const seedNodes = new commander.Option(
  '-sn, --seed-nodes [nodeId1@host:port;nodeId2@host:port;...]',
  'Seed node address mappings',
)
  .argParser(binParsers.parseSeedNodes)
  .env('PK_SEED_NODES')
  .default([{}, true]);

const network = new commander.Option(
  '-n --network <network>',
  'Setting the desired default network.',
)
  .argParser(binParsers.parseNetwork)
  .env('PK_NETWORK')
  .default(config.network.mainnet);

const workers = new commander.Option(
  '-w --workers <count>',
  'Number of workers to use, defaults to number of cores with `all`, 0 means all cores, `false`|`null`|`none`|`no` means no multi-threading',
)
  .argParser(binParsers.parseCoreCount)
  .default(0, 'all');

const pullVault = new commander.Option(
  '-pv, --pull-vault <pullVaultNameOrId>',
  'Name or Id of the vault to pull from',
);

const forceNodeAdd = new commander.Option(
  '--force',
  'Force adding node to nodeGraph',
).default(false);

const overrideClone = new commander.Option(
  '--override',
  'Force clone node and append with a _1',
).default(false);

const noPing = new commander.Option('--no-ping', 'Skip ping step').default(
  true,
);

// We can't reference the object here, so we recreate the list of choices
const passwordLimitChoices = [
  'min',
  'max',
  'interactive',
  'moderate',
  'sensitive',
];

const passwordOpsLimit = new commander.Option(
  '--password-ops-limit <passwordOpsLimit>',
  'Limit the password generation operations',
)
  .choices(passwordLimitChoices)
  .env('PK_PASSWORD_OPS_LIMIT')
  .default('moderate');

const passwordMemLimit = new commander.Option(
  '--password-mem-limit <passwordMemLimit>',
  'Limit the password generation memory',
)
  .choices(passwordLimitChoices)
  .env('PK_PASSWORD_MEM_LIMIT')
  .default('moderate');

const privateKeyFile = new commander.Option(
  '--private-key-file <privateKeyFile>',
  'Override key creation with a private key JWE from a file',
);

const depth = new commander.Option(
  '-d, --depth [depth]',
  'The number of commits to retrieve',
).argParser(parseInt);

const commitId = new commander.Option(
  '-ci, --commit-id [commitId]',
  'Id for a specific commit to read from',
);

export {
  nodePath,
  format,
  verbose,
  fresh,
  nodeId,
  clientHost,
  clientPort,
  agentHost,
  agentPort,
  connConnectTime,
  recoveryCodeFile,
  passwordFile,
  passwordNewFile,
  background,
  backgroundOutFile,
  backgroundErrFile,
  seedNodes,
  network,
  workers,
  pullVault,
  forceNodeAdd,
  noPing,
  privateKeyFile,
  passwordOpsLimit,
  passwordMemLimit,
  depth,
  commitId,
  overrideClone,
};
