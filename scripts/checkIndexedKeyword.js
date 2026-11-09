import '../loadEnv.js';
import { findIndexedPages } from '../src/seo/indexedPages.js';
import { SeoError } from '../src/seo/providerHttp.js';

const [domain, keyword, ...extra] = process.argv.slice(2);
if (!domain || !keyword || extra.length) {
  console.error('Usage: npm run seo:keyword -- example.com "exact keyword"');
  process.exitCode = 1;
} else {
  try { console.log(JSON.stringify(await findIndexedPages({ domain, keyword }), null, 2)); }
  catch (error) { console.error(error instanceof SeoError ? error.message : 'Unable to query indexed pages.'); process.exitCode = 1; }
}
