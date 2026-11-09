import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { hasClass, requireNative, oneNative, nativeCountryName, nativeLocationCountryName, readNativeJobPosting } from '../../scraper-support/shared/nativeJobPosting.js';
export const HOME = 'https://www.coursera.org/';
export const CAREERS_ROOT = 'https://careers.coursera.com/';
// This is the retained native root redirect's final HTTPS URL, not an invented route.
export const PORTAL = 'https://careers.coursera.com/homepage';
export const BOARD = 'https://careers.coursera.com/jobs/search/careers';
const blockedSlugs = new Set(['search', 'apply', 'login', 'register', 'homepage', 'job-alerts']);
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Coursera URL type');
  const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved Coursera URL');
  if (url.origin === new URL(HOME).origin) { requireNative(url.pathname === '/' && !url.search, 'Unapproved corporate path'); return url; }
  requireNative(url.origin === new URL(BOARD).origin, 'Unapproved careers origin');
  const path = url.pathname.replace(/\/$/, '');
  if (path === '' || path === '/homepage') requireNative(!url.search, 'Unapproved portal query');
  else if (path === '/jobs/search/careers') {
    requireNative([...url.searchParams.keys()].every(name => name === 'page') && url.searchParams.getAll('page').length <= 1, 'Unapproved search scope');
    const page = url.searchParams.get('page'); requireNative(page === null || /^[1-9]\d{0,3}$/.test(page) && Number(page) <= 1000, 'Unapproved search page');
  } else {
    const match = /^\/jobs\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
    requireNative(match && !blockedSlugs.has(match[1]) && !url.search, 'Unapproved role/application read path');
  }
  return url;
}
const pageNumber = value => Number(new URL(value).searchParams.get('page') || '1');
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected page base'); return doc; };
export function verifyHref(html, base, expected) {
  const doc = docOf(html);
  const urls = doc.nodes(node => node.tag === 'a' && node.attrs.href).map(node => { try { return new URL(node.attrs.href, base).href; } catch { return null; } });
  requireNative(urls.includes(expected), 'Current corporate/native handoff missing');
}
export function parseListing(html, url = BOARD) {
  validateURL(url); requireNative(new URL(url).pathname.replace(/\/$/, '') === '/jobs/search/careers', 'Not a native search page');
  const doc = docOf(html), page = pageNumber(url);
  const region = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'job-search-results-content')), 'native search results');
  const cards = doc.nodes(node => node.tag === 'div' && hasClass(node, 'job-search-results-card'), region);
  const pagination = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'bottom-pagination')), 'native result range/pagination');
  const range = /Displaying (\d+) - (\d+) of (\d+) in total/.exec(doc.text(pagination));
  requireNative(range, 'Missing native range/total');
  const start = Number(range[1]), end = Number(range[2]), total = Number(range[3]), lastPage = Math.max(1, Math.ceil(total / 20));
  requireNative(total > 0 && total <= 20000 && start === (page - 1) * 20 + 1 && end === Math.min(page * 20, total) && cards.length === end - start + 1, 'Native range/card count mismatch');
  const active = oneNative(doc.nodes(node => node.tag === 'li' && node.attrs['aria-current'] === 'page', pagination), 'active native page');
  requireNative(doc.text(active) === String(page), 'Active native page mismatch');
  const records = [], errors = [];
  for (const card of cards) {
    const rawHTML = doc.outer(card);
    try {
      const heading = oneNative(doc.nodes(node => node.tag === 'h3' && hasClass(node, 'job-search-results-card-title'), card), 'native listing title');
      const anchor = oneNative(doc.nodes(node => node.tag === 'a' && node.attrs.href, heading), 'native listing role URL');
      const roleURL = new URL(anchor.attrs.href, url).href; validateURL(roleURL);
      requireNative(/^\/jobs\/[^/]+\/?$/.test(new URL(roleURL).pathname), 'Listing URL is not a role');
      const title = doc.text(heading); requireNative(title, 'Empty native listing title');
      const details = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'job-component-details'), card), 'native listing job identity');
      const id = /(?:^|\s)job-component-details-([a-f0-9]{32})(?=\s|$)/.exec(details.attrs.class || '')?.[1];
      requireNative(id, 'Missing native portal job ID');
      const locations = doc.nodes(node => node.tag === 'li' && hasClass(node, 'job-component-location'), details).map(node => doc.text(node));
      requireNative(locations.length > 0 && locations.every(value => value.trim()), 'Missing native listing geography');
      records.push({ id, title: norm(title), url: roleURL, locations, countries: locations.map(value => nativeLocationCountryName(value) || value), rawListingHTML: rawHTML });
    } catch (error) { errors.push({ message: error.message, rawCandidate: { rawHTML } }); }
  }
  const nextURLs = [...new Set(doc.nodes(node => node.tag === 'a' && (node.attrs.rel || '').split(/\s+/).includes('next') && node.attrs.href, pagination).map(node => new URL(node.attrs.href, url).href))];
  requireNative(nextURLs.length <= 1, 'Conflicting native next links');
  const nextURL = nextURLs[0] || null;
  if (page < lastPage) { requireNative(nextURL, 'Missing native continuation'); validateURL(nextURL); requireNative(pageNumber(nextURL) === page + 1 && new URL(nextURL).pathname.replace(/\/$/, '') === '/jobs/search/careers', 'Native continuation changes scope/page'); }
  else requireNative(page === lastPage && !nextURL, 'Unexpected continuation beyond native total');
  return { records, errors, observedRows: cards.length, pageNumber: page, reportedTotal: total, lastPage, nextURL, terminationKnown: !nextURL && end === total };
}

const postingConfig = {
  requireSchemaIdentifier: true, identifierName: 'Coursera', acceptedHiringOrganizations: ['Coursera'],
  visibleTitle: doc => doc.text(oneNative(doc.nodes(node => node.tag === 'h3' && hasClass(node, 'job-title')), 'visible role title')),
  visibleDescriptionHTML: doc => doc.inner(oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'job-description')), 'visible full job description')),
  visibleLocations: doc => doc.nodes(node => node.tag === 'li' && hasClass(node, 'job-component-location')).map(node => doc.text(node)),
  rolePageText: doc => doc.text(oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'page-body')), 'visible role page')),
  applicationEvidence: (doc, posting, row) => {
    const anchors = doc.nodes(node => node.tag === 'a' && node.attrs.href);
    const internal = anchors.filter(node => /courserian|internal[-_ ]?(?:job|board)|employee job board/i.test(doc.text(node) + ' ' + node.attrs.href));
    const applications = [...new Set(anchors.filter(node => !internal.includes(node) && /^apply(?: now| for this (?:job|role))?$/i.test(doc.text(node))).map(node => new URL(node.attrs.href, row.url).href))];
    requireNative(applications.length <= 1, 'Ambiguous native public application links');
    if (applications.length) { const url = new URL(applications[0]); requireNative(url.protocol === 'https:' && !url.username && !url.password, 'Unsafe native application URL'); }
    return { nativeApplicationURL: applications[0] || null, internalEmployeeBoardLinks: [...new Set(internal.map(node => new URL(node.attrs.href, row.url).href))] };
  },
};
export const parseDetail = (html, row) => readNativeJobPosting(html, row, postingConfig);
export const CONFIG = {
  source: 'coursera', companyName: 'Coursera', boardURL: BOARD, validateURL, parseListing, parseDetail,
  handoffs: [
    { url: HOME, verify: html => verifyHref(html, HOME, CAREERS_ROOT) },
    { url: PORTAL, verify: html => verifyHref(html, PORTAL, BOARD) },
  ],
  sameReadIdentity: (left, right) => {
    const a = validateURL(left), b = validateURL(right);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '') && (a.pathname.replace(/\/$/, '') !== '/jobs/search/careers' ? a.search === b.search : pageNumber(left) === pageNumber(right));
  },
  candidateForIndia: row => row.countries.some(value => nativeCountryName(value) === 'India') || row.countries.some(value => !nativeCountryName(value)),
  pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, page: page.pageNumber, last: page.lastPage, rows: page.records.map(row => [row.id, row.title, row.url, row.locations]), errors: page.errors }),
};
