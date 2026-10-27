import { checkNativeCoverage, cleanNativeCoverage } from './check-native-coverage.js';
import { checkNativeLines } from './check-native-lines.js';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import { buildSite } from './build.js';
import { buildHub, runHub } from './build-hub.js';
import { buildIcons } from './build-icons.js';
import { buildInfo, buildInfoModule } from './build-info.js';
import { startDevServer } from './dev-server.js';
import { errorMessage, toolError } from './hub-files.js';
import { assembleRelease, compareVersions, readMetadataField } from './release.js';

export const runCommand = (command: string | undefined, version: string | undefined, secondArgument?: string): Effect.Effect<unknown, Error> => {
  switch (command) {
    case 'check:native-lines': return checkNativeLines();
    case 'clean:native-coverage': return cleanNativeCoverage();
    case 'check:native-coverage': return checkNativeCoverage().pipe(Effect.tap((summary) => Effect.sync(() => { console.log(JSON.stringify(summary, null, 2)); })));
    case 'build': return buildSite();
    case 'build:hub': return buildSite().pipe(Effect.flatMap(() => buildHub()), Effect.tap((info) => Effect.sync(() => { console.log(JSON.stringify(info, null, 2)); })));
    case 'release:manifest': return version === undefined ? Effect.fail(new Error('release:manifest requires a directory')) : assembleRelease(version);
    case 'build:icons': return buildIcons();
    case 'build:info': return buildInfo(version ?? null).pipe(Effect.tap((info) => Effect.sync(() => { process.stdout.write(buildInfoModule(info)); })));
    case 'release:field':
    case 'release:compare': {
      if (version === undefined || secondArgument === undefined) return Effect.fail(new Error(`${command} requires two arguments`));
      const output = command === 'release:field' ? readMetadataField(version, secondArgument)
        : Effect.try({ try: () => compareVersions(version, secondArgument).toString(), catch: toolError });
      return output.pipe(Effect.tap((value) => Effect.sync(() => { process.stdout.write(value); })));
    }
    case 'dev:hub': return buildSite().pipe(Effect.flatMap(() => runHub()));
    case 'dev': {
      const options = {
        port: Number(process.env['PORT']) || 8080,
        host: process.env['HOST'] ?? '127.0.0.1',
        beforeRequest: () => Effect.runPromise(buildSite()),
      };
      return buildSite().pipe(Effect.flatMap(() => startDevServer(options)),
        Effect.tap(() => Effect.sync(() => { console.log(`Serving at http://${options.host}:${options.port.toString()}`); })));
    }
    case undefined:
    default: return Effect.fail(new Error('Expected build, build:hub, build:icons, build:info, dev, dev:hub, release:field, release:compare, release:manifest, clean:native-coverage, check:native-coverage, or check:native-lines'));
  }
};
export const execution: Promise<unknown> = process.argv[1] === fileURLToPath(import.meta.url)
  ? Effect.runPromise(runCommand(process.argv[2], process.argv[3], process.argv[4])).catch((cause: unknown) => {
    console.error(errorMessage(cause));
    process.exitCode = 1;
  })
  : Promise.resolve();
