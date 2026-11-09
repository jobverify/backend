import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { hasClass, requireNative, oneNative, nativeCountryName, nativeLocationCountryName, readNativeJobPosting } from '../../scraper-support/shared/nativeJobPosting.js';
export const HOME = 'https://www.burohappold.com/careers/';
export const BOARD = 'https://vacancies.burohappold.com/';
// The native page2 pagination uses /jobs/search/-1/ as its page1 alias.
const pagePath = /^\/jobs\/search\/-1\/(?:([1-9]\d{0,3})\/?)?$/;
const rolePath = /^\/jobs\/job\/([A-Za-z0-9]+(?:-+[A-Za-z0-9]+)*)\/([1-9]\d{0,9})\/?$/;
const locationKey = value => norm(value).toLowerCase().replace(/\s*([,;])\s*/g, '$1');
const locationLabelsAgree = (visible, listed) => JSON.stringify(visible.map(locationKey)) === JSON.stringify(listed.map(locationKey));
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Buro Happold URL type');
  const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search, 'Unapproved Buro Happold read URL');
  if (url.origin === new URL(HOME).origin) requireNative(url.pathname.replace(/\/$/, '') === '/careers', 'Unapproved corporate read path');
  else {
    requireNative(url.origin === new URL(BOARD).origin, 'Unapproved Buro Happold origin');
    const page = pagePath.exec(url.pathname);
    requireNative(url.pathname === '/' || page && Number(page[1] || 1) <= 1000 || rolePath.test(url.pathname), 'Unapproved vacancy/application read path');
  }
  return url;
}
const pageNumber = value => { const path = validateURL(value).pathname, match = pagePath.exec(path); return path === '/' ? 1 : match ? Number(match[1] || 1) : NaN; };
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function parseListing(html, url = BOARD) {
  const page = pageNumber(url); requireNative(Number.isInteger(page) && page > 0, 'Not an unfiltered native search page');
  const doc = docOf(html);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native board heading')) === 'Jobs and careers with Buro Happold', 'Native board identity changed');
  const cards = doc.nodes(node => node.tag === 'a' && hasClass(node, 'in-app'));
  const navigation = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'pagination') && node.attrs.role === 'navigation'), 'native pagination');
  const active = oneNative(doc.nodes(node => node.tag === 'strong' && /^\d+$/.test(doc.text(node)), navigation), 'native active page');
  requireNative(doc.text(active) === String(page), 'Native active page mismatch');
  const links = doc.nodes(node => node.tag === 'a' && node.attrs.href, navigation).map(node => {
    const target = new URL(node.attrs.href, url).href, number = pageNumber(target);
    requireNative(new URL(target).origin === new URL(BOARD).origin && Number.isInteger(number) && number > 0, 'Native page link changes scope');
    return { url: target, number, text: doc.text(node) };
  });
  const lastPage = Math.max(page, ...links.map(link => link.number));
  const last = links.filter(link => /^Last\b/i.test(link.text));
  requireNative(last.length <= 1 && (!last.length || last[0].number === lastPage), 'Conflicting native last page');
  const next = links.filter(link => /^Next results page\b/.test(link.text));
  requireNative(next.length <= 1, 'Conflicting native next pages');
  const nextURL = next[0]?.url || null;
  if (page < lastPage) requireNative(next.length === 1 && next[0].number === page + 1, 'Missing/noncontiguous native continuation');
  else requireNative(!nextURL, 'Unexpected continuation beyond last native page');
  requireNative(cards.length > 0 && cards.length <= 10 && (!nextURL || cards.length === 10), 'Unknown native empty/ragged page inventory');
  const records = [], errors = [];
  for (const card of cards) {
    const rawHTML = doc.outer(card);
    try {
      requireNative(card.attrs.itemprop === 'url', 'Native card URL semantics missing');
      const roleURL = new URL(card.attrs.href, url).href, path = validateURL(roleURL).pathname, identity = rolePath.exec(path);
      requireNative(identity, 'Native card has no role identity');
      const details = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'job-list-details'), card), 'native job card');
      const title = doc.text(oneNative(doc.nodes(node => node.tag === 'span' && hasClass(node, 'job-list-title'), details), 'native job title'));
      const location = oneNative(doc.nodes(node => node.attrs.itemprop === 'jobLocation', details), 'native listing location');
      const label = doc.text(oneNative(doc.nodes(node => node.attrs.itemprop === 'address', location), 'native listing address'));
      requireNative(title && label, 'Empty native title/location');
      const employment = doc.nodes(node => node.attrs.itemprop === 'employmentType', details);
      requireNative(employment.length <= 1, 'Ambiguous native contract type');
      records.push({ id: identity[2], title: norm(title), url: roleURL, locations: [label], countries: [nativeLocationCountryName(label) || label], nativeEmploymentTypeLabel: employment.length ? doc.text(employment[0]) : null, rawListingHTML: rawHTML });
    } catch (error) { errors.push({ message: error.message, rawCandidate: { rawHTML } }); }
  }
  return { records, errors, observedRows: cards.length, pageNumber: page, reportedTotal: null, lastPage, nextURL, terminationKnown: !nextURL && page === lastPage };
}
const summary = doc => {
  const entries = doc.nodes(node => node.tag === 'li' && doc.nodes(child => child.tag === 'strong' && hasClass(child, 'label'), node).length === 1);
  const values = new Map();
  for (const entry of entries) {
    const label = oneNative(doc.nodes(node => node.tag === 'strong' && hasClass(node, 'label'), entry), 'summary label'), name = doc.text(label);
    requireNative(!values.has(name), 'Duplicate native summary label');
    const text = doc.text(entry); requireNative(text.startsWith(name), 'Malformed native summary'); values.set(name, text.slice(name.length).trim());
  }
  return values;
};
const summaryValue = (doc, label) => { const value = summary(doc).get(label); requireNative(typeof value === 'string' && value, 'Missing native ' + label); return value; };
const postingConfig = {
  requireSchemaIdentifier: false, acceptedHiringOrganizations: ['Buro Happold Limited'], compareLocationLabels: locationLabelsAgree,
  visibleTitle: doc => doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'visible role heading')),
  visibleDescriptionHTML: doc => {
    const main = oneNative(doc.nodes(node => node.attrs.id === 'job_main'), 'main role description');
    return doc.inner(oneNative(doc.nodes(node => hasClass(node, 'feature-text'), main), 'full visible role description'));
  },
  visibleLocations: doc => [summaryValue(doc, 'Location')],
  rolePageText: doc => doc.text(doc.root),
  applicationEvidence: (doc, posting, row) => {
    const applications = [...new Set(doc.nodes(node => node.tag === 'a' && doc.text(node) === 'Apply' && node.attrs.href).map(node => new URL(node.attrs.href, row.url).href))];
    requireNative(applications.length === 1, 'Missing/ambiguous native application link');
    const url = new URL(applications[0]);
    requireNative(url.protocol === 'https:' && !url.username && !url.password && !url.hash && url.origin === 'https://careershub.burohappold.com' && url.pathname === '/members/' && url.searchParams.getAll('j').length === 1 && url.searchParams.get('j') === row.id && url.searchParams.getAll('lang').length === 1 && url.searchParams.get('lang') === 'en' && [...url.searchParams.keys()].every(key => ['j', 'lang'].includes(key)), 'Native application/role identity mismatch');
    return { nativeApplicationURL: applications[0] };
  },
};
export function parseDetail(html, row) {
  const doc = docOf(html), reference = summaryValue(doc, 'Job Reference');
  requireNative(new RegExp('^burohappold/TP/[1-9]\\d*/' + row.id + '$').test(reference), 'Native job reference/URL identity mismatch');
  const fact = readNativeJobPosting(html, row, postingConfig);
  if (fact.excluded) return { ...fact, nativeJobReference: reference, nativeVisibleSummary: Object.fromEntries(summary(doc)),
    nativeVisibleClosingDateLabel: summary(doc).get('Closing Date') ?? null,
    nativeExpiryUIValidation: 'not-applied-to-excluded-role' };
  for (const address of fact.nativeCountryAddresses.filter(value => value.country === 'India')) {
    const city = address.raw.addressLocality;
    requireNative(typeof city === 'string' && city.trim(), 'Missing explicit native India locality');
    const cities = city.split(/[,;]/).map(part => norm(part).toLowerCase());
    requireNative(cities.every(Boolean) && row.locations.some(label => {
      const parts = label.split(/[,;]/).map(part => norm(part).toLowerCase());
      return cities.every(city => parts.includes(city));
    }), 'Visible/native city location conflict');
  }
  const closingLabel = summaryValue(doc, 'Closing Date');
  if (fact.nativeValidThrough.iso) {
    const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(fact.nativeValidThrough.iso));
    requireNative(closingLabel.replace(/,\s*/g, ' ') === day, 'Visible/JobPosting expiry mismatch');
  } else requireNative(/^No expiry date$/i.test(closingLabel), 'Unreconciled visible expiry');
  return { ...fact, nativeJobReference: reference, nativeVisibleSummary: Object.fromEntries(summary(doc)), nativeVisibleClosingDateLabel: closingLabel };
}
export const CONFIG = {
  source: 'burohappold', companyName: 'Buro Happold', boardURL: BOARD, validateURL, parseListing, parseDetail, locationLabelsAgree,
  handoffs: [{ url: HOME, verify: html => { const doc = docOf(html); requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href).some(node => { try { return new URL(node.attrs.href, HOME).href === BOARD; } catch { return false; } }), 'Official corporate vacancy handoff missing'); } }],
  sameReadIdentity: (left, right) => { const a = validateURL(left), b = validateURL(right); return a.origin === b.origin && (Number.isInteger(pageNumber(left)) && Number.isInteger(pageNumber(right)) ? pageNumber(left) === pageNumber(right) : a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')); },
  candidateForIndia: row => row.countries.some(value => nativeCountryName(value) === 'India') || row.countries.some(value => !nativeCountryName(value)),
  pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, page: page.pageNumber, last: page.lastPage, rows: page.records.map(row => [row.id, row.title, row.url, row.locations, row.nativeEmploymentTypeLabel]), errors: page.errors }),
};
