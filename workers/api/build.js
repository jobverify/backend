import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { parse } from 'acorn';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = path.resolve(directory, '../..');
const adapters = {
  'loadEnv.js': 'loadEnv.js',
  'src/pipeline/local.js': 'pipelineLocal.js',
  'src/pipeline/download.js': 'pipelineDownload.js',
  'src/monitoring/sentry.js': 'monitoring.js',
  'src/services/resumeText.js': 'resumeText.js',
  'src/services/autoApplyBrowser.js': 'autoApplyBrowser.js',
  'src/jobVerification/safeFetch.js': 'verificationFetch.js',
  'src/utils/sendEmail.js': 'sendEmail.js',
};

// Resolve platform boundaries by absolute filename, including dynamic imports.
// Normal Node/GitHub execution continues using the original implementations.
export async function bundleWorker(build, { outfile = path.join(directory, 'dist/worker.js') } = {}) {
  const platformFiles = new Map(Object.entries(adapters).map(([source, adapter]) => [
    path.resolve(root, source).toLowerCase(), path.join(directory, 'adapters', adapter),
  ]));
  const result = await build({
    absWorkingDir: root, entryPoints: [path.join(directory, 'src/index.js')], outfile,
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022',
    conditions: ['workerd', 'node'], mainFields: ['module', 'main'],
    external: ['node:*', 'cloudflare:*'], minify: true, metafile: true,
    define: { 'import.meta.url': JSON.stringify('file:///worker.js') },
    // CJS dependencies use require() for Node builtins; Workers supports these
    // through createRequire. All non-builtin dependencies must be bundled.
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire('/worker.js');" },
    plugins: [{ name: 'jobverify-workers-platform', setup(builder) {
      builder.onLoad({ filter: /myworkday[\\/]engine\.js$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8');
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        const names = new Set(['WORKDAY_OUTAGE_TEXT_PATTERNS', 'WORKDAY_OUTAGE_URL_PATTERNS', 'hasWorkdayOutageSignal']);
        const statements = ast.body.filter(statement => {
          const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
          return declaration?.declarations?.some(item => names.has(item.id.name));
        });
        if (statements.length !== 3) throw new Error('Workday outage helper structure changed; review the Worker build.');
        return { contents: statements.map(statement => source.slice(statement.start, statement.end)).join('\n'), loader: 'js' };
      });
      builder.onLoad({ filter: /providers[\\/](?:index|sourceInventory)\.js$/ }, async args => {
        const { getScraperCatalog } = await import(pathToFileURL(path.join(root, 'scraper-support/providers/index.js')).href);
        const { getDiskBackedScraperSources } = await import(pathToFileURL(path.join(root, 'scraper-support/providers/sourceInventory.js')).href);
        const sources = getDiskBackedScraperSources({ catalog: getScraperCatalog() });
        const contents = path.basename(args.path) === 'index.js'
          ? `const sources = ${JSON.stringify(sources)}; export const getScraperCatalog = () => sources.map(source => ({source}));`
          : `const sources = new Set(${JSON.stringify(sources)}); export const getDiskBackedScraperSources = ({catalog = []} = {}) => catalog.map(row => row.source).filter(source => sources.has(source));`;
        return { contents, loader: 'js' };
      });
      // These repository-owned policies/templates read files during Node module
      // initialization. Snapshot their exact values at build time, retaining
      // policy hashes shared with GitHub workers instead of reading a fake FS.
      builder.onLoad({ filter: /(?:jobDescriptionPolicy|jobClassificationPolicy|postScrapeClassification|resumeLatexFormat|batchEligibilityExtraction)\.js$/ }, async args => {
        const source = await fs.readFile(args.path, 'utf8');
        const values = await import(pathToFileURL(args.path).href);
        const snapshots = {};
        const selected = {
          'jobDescriptionPolicy.js': ['REWRITE_MODEL'],
          'jobClassificationPolicy.js': ['CLASSIFICATION_POLICY', 'CLASSIFICATION_MODEL', 'POLICY_HASH', 'RUNTIME_HASH'],
          'postScrapeClassification.js': ['GLICLASS_CONFIG', 'GLICLASS_IDENTITY'],
          'resumeLatexFormat.js': ['RESUME_ABEY_TEMPLATE'],
          'batchEligibilityExtraction.js': ['BATCH_EXTRACTION_IDENTITY'],
        }[path.basename(args.path)];
        for (const name of selected) snapshots[name] = values[name];
        if (path.basename(args.path) === 'jobClassificationPolicy.js') snapshots.policyBytes = (await fs.readFile(path.join(root, 'classification/policy.json'), 'utf8')).replace(/\r\n/g, '\n');
        if (path.basename(args.path) === 'postScrapeClassification.js') snapshots.runtimeHash = values.GLICLASS_IDENTITY.runtimeHash;
        if (path.basename(args.path) === 'batchEligibilityExtraction.js') snapshots.samples = JSON.parse(await fs.readFile(path.join(root, 'test/test-data/batchEligibilityExtraction.json'), 'utf8'));
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
        const edits = [];
        for (const statement of ast.body) {
          const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
          for (const item of declaration?.declarations || []) {
            if (Object.hasOwn(snapshots, item.id.name)) edits.push({ start: item.init.start, end: item.init.end, text: JSON.stringify(snapshots[item.id.name]) });
          }
        }
        let contents = source;
        for (const edit of edits.sort((a, b) => b.start - a.start)) contents = contents.slice(0, edit.start) + edit.text + contents.slice(edit.end);
        return { contents, loader: 'js', resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /^\./ }, args => {
        const replacement = platformFiles.get(path.resolve(args.resolveDir, args.path).toLowerCase());
        return replacement ? { path: replacement } : undefined;
      });
    } }],
  });
  const code = result.outputFiles.find(file => file.path === outfile);
  const compressedBytes = gzipSync(code.contents).length;
  if (compressedBytes > 3 * 1024 * 1024) throw new Error(`Worker exceeds the Free plan's 3 MiB compressed script limit (${compressedBytes} bytes).`);
  // Keep accidental native/browser dependencies out of the deployment.
  const forbidden = Object.keys(result.metafile.inputs).filter(name => /node_modules\/(?:playwright(?:-core)?|@napi-rs\/canvas|tesseract\.js|pdfjs-dist|@sentry\/node)\//.test(name.replaceAll('\\', '/')));
  if (forbidden.length) throw new Error('Worker includes unsupported native dependencies.');
  await fs.mkdir(path.dirname(outfile), { recursive: true });
  await fs.writeFile(outfile, code.contents);
  await fs.writeFile(path.join(path.dirname(outfile), 'build-report.json'), JSON.stringify({
    compressedBytes, freePlanScriptLimit: 3 * 1024 * 1024, inputs: Object.keys(result.metafile.inputs),
    imports: Object.values(result.metafile.outputs).flatMap(output => output.imports),
  }, null, 2));
  console.log(`Cloudflare API bundled: ${compressedBytes} gzip bytes (Free limit: 3145728).`);
  return { compressedBytes, metafile: result.metafile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { build } = await import('esbuild');
  await bundleWorker(build);
}

