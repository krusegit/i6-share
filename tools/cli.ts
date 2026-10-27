import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import { buildSite } from './build.js';
import { buildHub } from './build-hub.js';
import { buildIcons } from './build-icons.js';
import { buildInfo, buildInfoModule } from './build-info.js';
import { startDevServer } from './dev-server.js';
import { startHubDevServer } from './dev-hub.js';
import { errorMessage, toolError } from './hub-files.js';
import { compareVersions, readMetadataField } from './release.js';

export const runCommand = (command: string | undefined, version: string | undefined, secondArgument?: string): Effect.Effect<unknown, Error> => {
  switch (command) {
    case 'build': return buildSite();
    case 'build:hub': return buildSite().pipe(Effect.flatMap(() => buildHub()), Effect.tap((info) => Effect.sync(() => { console.log(JSON.stringify(info, null, 2)); })));
    case 'build:icons': return buildIcons();
    case 'build:info': return buildInfo(version ?? null).pipe(Effect.tap((info) => Effect.sync(() => { process.stdout.write(buildInfoModule(info)); })));
    case 'release:field':
    case 'release:compare': {
      if (version === undefined || secondArgument === undefined) return Effect.fail(new Error(`${command} requires two arguments`));
      const output = command === 'release:field' ? readMetadataField(version, secondArgument)
        : Effect.try({ try: () => compareVersions(version, secondArgument).toString(), catch: toolError });
      return output.pipe(Effect.tap((value) => Effect.sync(() => { process.stdout.write(value); })));
    }
    case 'dev':
    case 'dev:hub': {
      const options = {
        port: Number(process.env['PORT']) || (command === 'dev' ? 8080 : 5193),
        host: process.env['HOST'] ?? '127.0.0.1',
        beforeRequest: () => Effect.runPromise(buildSite()),
      };
      return buildSite().pipe(Effect.flatMap(() => command === 'dev' ? startDevServer(options) : startHubDevServer(options)),
        Effect.tap(() => Effect.sync(() => { console.log(`Serving at http://${options.host}:${options.port.toString()}`); })));
    }
    case undefined:
    default: return Effect.fail(new Error('Expected build, build:hub, build:icons, build:info, dev, dev:hub, release:field, or release:compare'));
  }
};
export const execution: Promise<unknown> = process.argv[1] === fileURLToPath(import.meta.url)
  ? Effect.runPromise(runCommand(process.argv[2], process.argv[3], process.argv[4])).catch((cause: unknown) => {
    console.error(errorMessage(cause));
    process.exitCode = 1;
  })
  : Promise.resolve();
