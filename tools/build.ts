import fs from 'node:fs';
import path from 'node:path';
import { build as bundle, type BuildOptions } from 'esbuild';
import { Effect } from 'effect';
import { buildInfo, buildInfoModule, type BuildInfo } from './build-info.js';
import { ROOT, toolError, walkFiles } from './hub-files.js';

export interface BuildOptionsInput { readonly root?: string; readonly outDir?: string; readonly info?: BuildInfo }
export type BrowserBundler = (options: BuildOptions) => Promise<unknown>;
export const bundleBrowser: BrowserBundler = bundle;
const phoneEntries = ['app', 'client', 'sw', 'setup/setup', 'lib/proto', 'lib/dom', 'lib/store'];
export const copyStatic = (source: string, destination: string): void => {
  walkFiles(source).filter(({ urlPath }) => !/\.(?:[cm]?js|ts|map)$/.test(urlPath) && !/^\/(?:hub|downloads)\//.test(urlPath))
    .forEach(({ urlPath, file }) => {
      const output = path.join(destination, urlPath);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(file, output);
    });
};

/** Bundle Effect and local modules into offline, CSP-compatible browser entrypoints. */
export const buildSite = (options: BuildOptionsInput = {}, bundler: BrowserBundler = bundleBrowser): Effect.Effect<string, Error> => Effect.gen(function* () {
  const root = options.root ?? ROOT;
  const outDir = options.outDir ?? path.join(root, 'dist');
  const info = options.info ?? (yield* buildInfo());
  yield* Effect.try({ try: () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.rmSync(path.join(outDir, 'hub'), { recursive: true, force: true });
    fs.rmSync(path.join(outDir, 'public/hub'), { recursive: true, force: true });
    copyStatic(path.join(root, 'public'), path.join(outDir, 'public'));
    copyStatic(path.join(root, 'hub'), path.join(outDir, 'hub'));
    fs.copyFileSync(path.join(root, 'public/style.css'), path.join(outDir, 'hub/style.css'));
    copyStatic(path.join(root, 'public/icons'), path.join(outDir, 'hub/icons'));
  }, catch: toolError });
  const common: BuildOptions = {
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', sourcemap: true,
    plugins: [{ name: 'build-info', setup: (plugin) => {
      plugin.onResolve({ filter: /(?:^|\/)build-info\.js$/ }, ({ path: importPath }) => ({
        path: importPath === '../public/build-info.js' ? './build-info.js' : importPath, external: true,
      }));
      plugin.onLoad({ filter: /(?:app|hub|sw|setup)\.ts$/ }, ({ path: sourcePath }) => {
        const initializers: Readonly<Record<string, string>> = {
          'app.ts': 'void initializePhoneUi().catch(console.error);',
          'hub.ts': 'void initializeHubUi().catch(console.error);',
          'sw.ts': 'initializeServiceWorker();',
          'setup.ts': 'void initializeSetup().catch(console.error);',
        };
        return { contents: `${fs.readFileSync(sourcePath, 'utf8')}\n${initializers[path.basename(sourcePath)] ?? ''}\n`, loader: 'ts' };
      });
    } }],
  };
  yield* Effect.tryPromise({ try: () => bundler({ ...common,
    entryPoints: phoneEntries.map((name) => path.join(root, 'public', `${name}.ts`)),
    outbase: path.join(root, 'public'), outdir: path.join(outDir, 'public'),
  }), catch: toolError });
  yield* Effect.tryPromise({ try: () => bundler({ ...common,
    entryPoints: [path.join(root, 'hub/hub.ts')], outbase: path.join(root, 'hub'), outdir: path.join(outDir, 'hub'),
  }), catch: toolError });
  yield* Effect.try({ try: () => {
    fs.writeFileSync(path.join(outDir, 'public/build-info.js'), buildInfoModule(info));
    fs.copyFileSync(path.join(outDir, 'public/build-info.js'), path.join(outDir, 'hub/build-info.js'));
  }, catch: toolError });
  return outDir;
});
