import fs from 'node:fs';
import path from 'node:path';
import { Effect, Schema } from 'effect';
import { ROOT, toolError, walkFiles } from './hub-files.js';

export const REPORTS_DIR = path.join(ROOT, 'artifacts', 'native-coverage');
const BranchSchema = Schema.Struct({ Line: Schema.Number, Offset: Schema.Number, EndOffset: Schema.Number, Path: Schema.Number, Ordinal: Schema.Number, Hits: Schema.Number });
const MethodSchema = Schema.Struct({ Lines: Schema.Record(Schema.String, Schema.Number), Branches: Schema.Array(BranchSchema) });
const CoverageSchema = Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Record(Schema.String, MethodSchema))));
export type NativeCoverage = typeof CoverageSchema.Type;
interface Point { readonly file: string; readonly kind: 'line' | 'branch'; readonly key: string; readonly hits: number; readonly label: string }
export interface CoverageMetric { readonly total: number; readonly covered: number; readonly percent: number }
export interface CoverageSummary {
  readonly lines: CoverageMetric;
  readonly branches: CoverageMetric;
  readonly files: readonly { readonly file: string; readonly lines: CoverageMetric; readonly branches: CoverageMetric }[];
  readonly missing: readonly string[];
}
export const decodeNativeCoverage = (input: unknown): NativeCoverage => Schema.decodeUnknownSync(CoverageSchema)(input);
const metric = (points: readonly Point[]): CoverageMetric => {
  const covered = points.filter((point) => point.hits > 0).length;
  return { total: points.length, covered, percent: points.length === 0 ? 100 : 100 * covered / points.length };
};

/** Merge individual test-assembly reports by actual source sequence/branch points. */
export const summarizeNativeCoverage = (reports: readonly NativeCoverage[]): CoverageSummary => {
  const modules = new Set(reports.flatMap((report) => Object.keys(report)));
  const expected = ['I6Share.Contracts.dll', 'I6Share.TypeGen.dll', 'i6-share-hub.dll'];
  const absent = expected.filter((module) => !modules.has(module));
  if (absent.length > 0) throw new Error(`Missing native coverage modules: ${absent.join(', ')}`);
  const points = reports.flatMap((report) => Object.values(report).flatMap((documents) =>
    Object.entries(documents).flatMap(([file, classes]) => Object.entries(classes).flatMap(([type, methods]) =>
      Object.entries(methods).flatMap(([method, coverage]): readonly Point[] => [
        ...Object.entries(coverage.Lines).map(([line, hits]): Point => ({ file, kind: 'line', key: `${file}:line:${line}`, hits, label: `${file}:${line}` })),
        ...coverage.Branches.map((branch): Point => ({ file, kind: 'branch',
          key: JSON.stringify([file, type, method, branch.Line, branch.Offset, branch.EndOffset, branch.Path, branch.Ordinal]),
          hits: branch.Hits, label: `${file}:${String(branch.Line)} branch ${String(branch.Ordinal)} (${method})` })),
      ])))));
  // Private scratch storage does not escape this pure aggregation.
  const merged = new Map<string, Point>();
  for (const point of points) {
    const previous = merged.get(point.key);
    merged.set(point.key, { ...point, hits: (previous?.hits ?? 0) + point.hits });
  }
  const all = [...merged.values()];
  if (all.length === 0) throw new Error('Native coverage reports contain no executable source');
  return {
    lines: metric(all.filter((point) => point.kind === 'line')),
    branches: metric(all.filter((point) => point.kind === 'branch')),
    files: [...new Set(all.map((point) => point.file))].sort().map((file) => ({ file,
      lines: metric(all.filter((point) => point.file === file && point.kind === 'line')),
      branches: metric(all.filter((point) => point.file === file && point.kind === 'branch')),
    })),
    missing: all.filter((point) => point.hits <= 0).map((point) => point.label).sort(),
  };
};

/** Reset reports before collection so a previous run cannot conceal uncovered code. */
export const cleanNativeCoverage = (directory = REPORTS_DIR): Effect.Effect<void, Error> => Effect.try({
  try: () => { fs.rmSync(directory, { recursive: true, force: true }); fs.mkdirSync(directory, { recursive: true }); }, catch: toolError,
});

export const checkNativeCoverage = (directory = REPORTS_DIR): Effect.Effect<CoverageSummary, Error> => Effect.try({
  try: () => {
    const files = walkFiles(directory).filter((entry) => path.basename(entry.file) === 'coverage.json');
    const reports = files.map(({ file }) => { const input: unknown = JSON.parse(fs.readFileSync(file, 'utf8')); return decodeNativeCoverage(input); });
    const summary = summarizeNativeCoverage(reports);
    fs.writeFileSync(path.join(directory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    if (summary.missing.length > 0) throw new Error(`Native coverage must be 100% lines and branches. Uncovered:\n${summary.missing.join('\n')}`);
    return summary;
  }, catch: toolError,
});
