import { document } from './rmkNativePairHtml.js';
import { requireNative, oneNative } from './nativeJobPosting.js';
import { verifyRmkCompanyToken } from './successFactorsRmk.js';
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
function readModel(doc, expectedApiEndpoint, expectedSearchQuery) {
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src && ['', 'application/javascript', 'text/javascript'].includes(node.attrs.type || '') && node.raw.includes('j2w.SearchResults.init'));
  const script = oneNative(scripts, 'native tile initializer').raw;
  const calls = [...script.matchAll(/j2w\.SearchResults\.init\s*\(\s*\{([\s\S]*?)\}\s*\)/g)];
  const raw = oneNative(calls, 'literal native tile initializer')[1], values = {};
  const pair = /\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*("(?:\\.|[^"\\])*"|parseInt\("\d+"\))\s*(,|$)/y;
  let index = 0;
  while (index < raw.length && raw.slice(index).trim()) {
    pair.lastIndex = index; const match = pair.exec(raw); requireNative(match && !Object.hasOwn(values, match[1]), 'Nonliteral/duplicate native tile model field');
    values[match[1]] = match[2].startsWith('parseInt') ? Number(/^parseInt\("(\d+)"\)$/.exec(match[2])[1]) : JSON.parse(match[2]); index = pair.lastIndex;
  }
  const keys = ['apiEndpoint', 'searchQuery', 'searchResults', 'lblSearchResultsBlank', 'tileSearchResultsText', 'tileSearchExplainationText', 'jobRecordsPerPage', 'jobRecordsFound'];
  requireNative(Object.keys(values).length === keys.length && keys.every(key => Object.hasOwn(values, key)), 'Native tile model keys changed');
  requireNative(values.apiEndpoint === expectedApiEndpoint && values.searchQuery === expectedSearchQuery && values.searchResults === '', 'Native tile model changes declared scope');
  requireNative(values.jobRecordsPerPage === 25 && Number.isInteger(values.jobRecordsFound) && values.jobRecordsFound >= 0 && values.jobRecordsFound <= 10000, 'Native tile page size/total invalid');
  return { total: values.jobRecordsFound, perPage: values.jobRecordsPerPage };
}
export function parseNativeTilePage(html, url, priorModel, { validateURL, nativeConfig, apiPrefix, parseTile, initialPath = '/search/', expectedApiEndpoint = 'tile-search-results', expectedSearchQuery = '?q=&sortColumn=referencedate&sortDirection=desc' }) {
  const parsedURL = validateURL(url), doc = docOf(html), initial = parsedURL.pathname === initialPath;
  let model = priorModel, scope = doc.root;
  if (initial) {
    verifyRmkCompanyToken(html, nativeConfig); model = readModel(doc, expectedApiEndpoint, expectedSearchQuery);
    scope = oneNative(doc.nodes(node => node.attrs.id === 'job-tile-list'), 'native tile list');
    requireNative(scope.attrs['data-per-page'] === '25' && scope.attrs['data-record-returned'] === String(Math.min(25, model.total)), 'Native tile list/model count conflict');
  }
  requireNative(model && Number.isInteger(model.total), 'Native first-page model unavailable');
  const offset = initial ? 0 : Number(parsedURL.searchParams.get('startrow')), pageNumber = offset / 25 + 1, lastPage = Math.max(1, Math.ceil(model.total / 25));
  requireNative(offset < model.total || model.total === 0 && offset === 0, 'Native page exceeds inventory');
  const tiles = doc.nodes(node => Object.hasOwn(node.attrs, 'data-row-index'), scope), expectedRows = Math.min(25, model.total - offset);
  requireNative(tiles.length === expectedRows, 'Incomplete native tile page rows');
  const records = [], errors = [];
  for (const [index, tile] of tiles.entries()) {
    try { records.push(parseTile(doc, tile, offset, index)); }
    catch (error) { errors.push({ message: error.message, rawCandidate: { rawHTML: doc.outer(tile) } }); }
  }
  const nextURL = offset + tiles.length < model.total ? apiPrefix + (offset + tiles.length) : null;
  return { records, errors, observedRows: tiles.length, pageNumber, lastPage, nextURL, reportedTotal: model.total, terminationKnown: !nextURL, model,
    nativeAriaRowCount: initial ? scope.attrs['aria-rowcount'] ?? null : null };
}
