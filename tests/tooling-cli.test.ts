import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import { afterEach, expect, it, vi } from 'vitest';
import type { ServerOptions } from '../tools/dev-server.js';

const mocks = vi.hoisted(() => ({
  checkLines: vi.fn<() => Effect.Effect<void, Error>>(),
  cleanCoverage: vi.fn<() => Effect.Effect<void, Error>>(),
  checkCoverage: vi.fn<() => Effect.Effect<unknown, Error>>(),
  manifest: vi.fn<(directory: string) => Effect.Effect<unknown, Error>>(),
  nativeRun: vi.fn<() => Effect.Effect<void, Error>>(),
  field: vi.fn<(file: string, key: string) => Effect.Effect<string, Error>>(),
  compare: vi.fn<(left: string, right: string) => -1 | 0 | 1>(),
  build: vi.fn<() => Effect.Effect<string, Error>>(),
  hub: vi.fn<() => Effect.Effect<unknown, Error>>(),
  icons: vi.fn<() => Effect.Effect<void, Error>>(),
  metadata: vi.fn<(version: string | null) => Effect.Effect<unknown>>(),
  publicServer: vi.fn<(options: ServerOptions) => Effect.Effect<void, Error>>(),
}));
vi.mock('../tools/check-native-coverage.js', () => ({ cleanNativeCoverage: mocks.cleanCoverage, checkNativeCoverage: mocks.checkCoverage }));
vi.mock('../tools/check-native-lines.js', () => ({ checkNativeLines: mocks.checkLines }));
vi.mock('../tools/release.js', () => ({ readMetadataField: mocks.field, compareVersions: mocks.compare, assembleRelease: mocks.manifest }));
vi.mock('../tools/build.js', () => ({ buildSite: mocks.build }));
vi.mock('../tools/build-hub.js', () => ({ buildHub: mocks.hub, runHub: mocks.nativeRun }));
vi.mock('../tools/build-icons.js', () => ({ buildIcons: mocks.icons }));
vi.mock('../tools/build-info.js', () => ({ buildInfo: mocks.metadata, buildInfoModule: () => 'metadata' }));
vi.mock('../tools/dev-server.js', () => ({ startDevServer: mocks.publicServer }));
const originalArgs = [...process.argv];
const originalExitCode = process.exitCode;
afterEach(() => { process.argv = [...originalArgs]; process.exitCode = originalExitCode; vi.unstubAllEnvs(); vi.resetModules(); });
const prepare = () => {
  mocks.checkLines.mockReturnValue(Effect.void);
  mocks.cleanCoverage.mockReturnValue(Effect.void); mocks.checkCoverage.mockReturnValue(Effect.succeed({ lines: 100, branches: 100 }));
  mocks.field.mockReturnValue(Effect.succeed('value')); mocks.compare.mockReturnValue(-1);
  mocks.build.mockReturnValue(Effect.succeed('/dist')); mocks.hub.mockReturnValue(Effect.succeed({ version: '1' })); mocks.icons.mockReturnValue(Effect.void);
  mocks.metadata.mockReturnValue(Effect.succeed({ version: '1' })); mocks.publicServer.mockReturnValue(Effect.void); mocks.nativeRun.mockReturnValue(Effect.void); mocks.manifest.mockReturnValue(Effect.succeed({ version: "1" }));
  vi.spyOn(console, 'log').mockImplementation(() => undefined); vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return vi.spyOn(process.stdout, 'write').mockReturnValue(true);
};
it('dispatches each command with environment and default arguments', async () => {
  const stdout = prepare(); const { runCommand, execution } = await import('../tools/cli.js'); await execution;
  for (const command of ['build', 'build:hub', 'build:icons', 'build:info', 'dev', 'dev:hub', 'clean:native-coverage', 'check:native-coverage', 'check:native-lines']) await Effect.runPromise(runCommand(command, undefined));
  await Effect.runPromise(runCommand('build:info', '2.0')); expect(mocks.metadata).toHaveBeenCalledWith('2.0');
  expect(mocks.publicServer).toHaveBeenCalledWith(expect.objectContaining({ port: 8080, host: '127.0.0.1' }));
  expect(mocks.nativeRun).toHaveBeenCalledOnce();
  expect(mocks.cleanCoverage).toHaveBeenCalledOnce(); expect(mocks.checkCoverage).toHaveBeenCalledOnce();
  expect(mocks.checkLines).toHaveBeenCalledOnce();
  expect(console.log).toHaveBeenCalledWith(JSON.stringify({ lines: 100, branches: 100 }, null, 2));
  await Effect.runPromise(runCommand('release:manifest', '/downloads')); expect(mocks.manifest).toHaveBeenCalledWith('/downloads');
  await expect(Effect.runPromise(runCommand('release:manifest', undefined))).rejects.toThrow('requires a directory');
  vi.stubEnv('PORT', '1234'); vi.stubEnv('HOST', '0.0.0.0'); await Effect.runPromise(runCommand('dev', undefined));
  expect(mocks.publicServer).toHaveBeenCalledWith(expect.objectContaining({ port: 1234, host: '0.0.0.0' }));
  await Effect.runPromise(runCommand('release:field', '/file', 'version'));
  expect(mocks.field).toHaveBeenCalledWith('/file', 'version');
  await Effect.runPromise(runCommand('release:compare', '1', '2'));
  expect(mocks.compare).toHaveBeenCalledWith('1', '2');
  expect(stdout).toHaveBeenCalledWith('-1');
  await expect(Effect.runPromise(runCommand('release:field', undefined, 'key'))).rejects.toThrow('requires two arguments');
  await expect(Effect.runPromise(runCommand('release:compare', '1'))).rejects.toThrow('requires two arguments');
  mocks.compare.mockImplementationOnce(() => { throw new Error('invalid version'); });
  await expect(Effect.runPromise(runCommand('release:compare', 'bad', '1'))).rejects.toThrow('invalid version');
  await expect(Effect.runPromise(runCommand('bad', undefined))).rejects.toThrow('Expected');
  await expect(Effect.runPromise(runCommand(undefined, undefined))).rejects.toThrow('Expected');
  const options = mocks.publicServer.mock.calls.at(-1)?.[0];
  if (options?.beforeRequest === undefined) throw new Error('Expected pre-request build');
  await options.beforeRequest();
});
it('runs the executable entry and reports failures with exit status', async () => {
  prepare(); process.argv = ['node', fileURLToPath(new URL('../tools/cli.ts', import.meta.url)), 'build'];
  await (await import('../tools/cli.js')).execution; expect(mocks.build).toHaveBeenCalled();
  vi.resetModules(); process.argv = ['node', fileURLToPath(new URL('../tools/cli.ts', import.meta.url)), 'unknown'];
  await (await import('../tools/cli.js')).execution; expect(process.exitCode).toBe(1); expect(console.error).toHaveBeenCalled();
});
