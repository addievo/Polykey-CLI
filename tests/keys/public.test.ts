import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import * as testUtils from '../utils';

describe('public', () => {
  const logger = new Logger('public test', LogLevel.WARN, [
    new StreamHandler(),
  ]);
  let agentDir;
  let agentPassword;
  let agentClose;
  beforeEach(async () => {
    ({ agentDir, agentPassword, agentClose } =
      await testUtils.setupTestAgent(logger));
  });
  afterEach(async () => {
    await agentClose();
  });
  testUtils.testIf(
    testUtils.isTestPlatformEmpty || testUtils.isTestPlatformDocker,
  )('public gets public key', async () => {
    const { exitCode, stdout } = await testUtils.pkExec(
      ['keys', 'public', 'password', '--format', 'json'],
      {
        env: {
          PK_NODE_PATH: agentDir,
          PK_PASSWORD: agentPassword,
        },
        cwd: agentDir,
        command: globalThis.testCmd,
      },
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      alg: expect.any(String),
      crv: expect.any(String),
      ext: expect.any(Boolean),
      key_ops: expect.any(Array),
      kty: expect.any(String),
      x: expect.any(String),
    });
  });
});
