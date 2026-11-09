import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeCountryName, plainNativeHTML, readNativeJobPosting } from '../../scraper-support/shared/nativeJobPosting.js';
export const CAREERS = 'https://www.celanese.com/en/careers';
export const ORIGIN = 'https://asiacareers-celanese.icims.com';
// Observed static-asset base, never a job/API/application read destination.
export const ASSET_BASE = 'https://c-1904-20191108-celanese-com.i.icims.com';
export const BOARD = ORIGIN + '/jobs/search?ss=1&mobile=false&width=1065&height=500&bga=true&needsRedirect=false&jan1offset=330&jun1offset=330';
const rolePath = /^\/jobs\/([1-9]\d{0,8})\/([^/]+)\/job$/;
const docOf = html => { const doc = document(html), bases = doc.nodes(node => node.tag === 'base'); requireNative(!bases.length || bases.length === 1 && Object.keys(bases[0].attrs).length === 1 && bases[0].attrs.href === ASSET_BASE, 'Unexpected native base URL'); return doc; };
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Celanese read URL type');
  const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved Celanese read URL');
  if (url.origin === 'https://www.celanese.com') requireNative(['/en/careers', '/careers'].includes(url.pathname) && !url.search, 'Unapproved corporate careers path');
  else {
    requireNative(url.origin === ORIGIN, 'Unapproved regional/source origin');
    if (url.pathname === '/jobs/search') {
      const defaults = { ss: '1', mobile: 'false', width: '1065', height: '500', bga: 'true', needsRedirect: 'false', jan1offset: '330', jun1offset: '330', schemaId: '', o: '', in_iframe: '1' };
      for (const name of new Set(url.searchParams.keys())) requireNative(url.searchParams.getAll(name).length === 1 && (name === 'pr' ? /^(?:0|[1-9]\d{0,2})$/.test(url.searchParams.get(name)) : Object.hasOwn(defaults, name) && url.searchParams.get(name) === defaults[name]), 'Unapproved native search filter/page');
    } else {
      const match = rolePath.exec(url.pathname);
      requireNative(match && (!url.search || url.search === '?in_iframe=1'), 'Unapproved native role/application read path');
      requireNative(!/[\\/?#\u0000-\u001f\u007f]/.test(decodeURIComponent(match[2])), 'Unapproved encoded role path');
    }
  }
  return url;
}
const pageNumber = value => { const url = validateURL(value); requireNative(url.origin === ORIGIN && url.pathname === '/jobs/search', 'Not a native Asia listing'); return Number(url.searchParams.get('pr') || 0) + 1; };
const frameQueryIdentity = url => JSON.stringify([...url.searchParams].filter(([name]) => name !== 'in_iframe').sort());
const sameReadIdentity = (left, right) => {
  const a = validateURL(left), b = validateURL(right);
  if (a.origin !== b.origin) return false;
  return a.pathname === '/jobs/search' && b.pathname === '/jobs/search' ? pageNumber(left) === pageNumber(right)
    : a.pathname.replace(/^\/en\//, '/') === b.pathname.replace(/^\/en\//, '/') && frameQueryIdentity(a) === frameQueryIdentity(b);
};
export function resolveReadFrame(html, currentURL) {
  const current = validateURL(currentURL);
  if (current.origin !== ORIGIN) return null;
  const doc = docOf(html);
  if (doc.nodes(node => hasClass(node, 'iCIMS_MainWrapper')).length) return null;
  const frames = [];
  const hidden = node => Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert') || node.attrs['aria-hidden'] === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))/i.test(node.attrs.style || '');
  const visit = node => {
    if (node.tag === 'noscript') {
      if (hidden(node)) return;
      // The explicit no-JavaScript fallback is read as inert markup only.
      const fallback = document(node.raw), elements = fallback.root.children.filter(child => typeof child !== 'string');
      const frame = elements[0];
      if (elements.length !== 1 || frame.tag !== 'iframe' || frame.attrs.id !== 'noscript_icims_content_iframe') return;
      requireNative(fallback.root.children.filter(child => typeof child === 'string').every(text => !text.trim()) && !frame.raw.trim(), 'Unexpected native fallback frame content');
      requireNative(!hidden(frame) && frame.attrs.name === 'noscript_icims_content_iframe' && frame.attrs.title === 'Noscript iCIMS Content iFrame', 'Native fallback frame identity changed');
      frames.push(frame); return;
    }
    if (node.inactive) return;
    for (const child of node.children) if (typeof child !== 'string') visit(child);
  };
  visit(doc.root);
  if (!frames.length) return null;
  const frame = oneNative(frames, 'native public fallback frame');
  requireNative(doc.nodes(node => node.tag === 'span' && node.attrs.id === 'icims_iframe_span' && node.attrs.role === 'main' && node.attrs['aria-label'] === 'Career Portal').length === 1, 'Native career portal frame slot missing');
  const target = validateURL(frame.attrs.src);
  requireNative(current.searchParams.get('in_iframe') !== '1' && target.searchParams.get('in_iframe') === '1'
    && current.origin === target.origin && current.pathname === target.pathname && frameQueryIdentity(current) === frameQueryIdentity(target), 'Native fallback frame changes search/role identity');
  return target.href;
}
export function verifyCorporateHandoff(html) {
  const doc = docOf(html), script = oneNative(doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/json' && node.attrs.id === '__JSS_STATE__'), 'native Sitecore JSON state');
  requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected corporate base URL');
  const state = JSON.parse(script.raw), context = state.sitecore?.context, route = state.sitecore?.route;
  requireNative(context?.site?.name === 'cewebjssapp' && context.pageState === 'normal' && context.pageEditing === false && context.language === 'en' && context.itemPath === '/careers' && route?.name === 'Careers' && route.itemLanguage === 'en', 'Native corporate route identity changed');
  const main = route.placeholders?.['jss-ceweb-main']; requireNative(Array.isArray(main), 'Missing active careers main components');
  const section = oneNative(main.filter(node => node.componentName === 'Section' && node.fields?.sectionId?.value === 'CareersCelanese'), 'active CareersCelanese section');
  const cards = section.placeholders?.['jss-ceweb-section']; requireNative(Array.isArray(cards), 'Missing native careers feature tiles');
  const features = cards.filter(node => node.componentName === 'FeatureTileCardWithCTA').flatMap(node => node.fields?.featureList || []);
  const region = oneNative(features.filter(node => node.name === 'By Region' && node.fields?.title?.value === 'By Region' && node.fields?.ctaLink1Text?.value === 'View Jobs'), 'unfiltered By Region jobs feature');
  const links = region.fields.ctaLink1modalPopupContent?.fields?.linkList; requireNative(Array.isArray(links), 'Missing native region portal handoffs');
  const asia = oneNative(links.filter(node => node.name === 'Asia' && node.fields?.title?.value === 'Asia'), 'Asia job region');
  const link = asia.fields.ctaLink1Link?.value;
  requireNative(link?.linktype === 'external' && link.href === BOARD && link.url === BOARD, 'Active corporate Asia portal handoff changed');
  return { source: 'native-application/json-__JSS_STATE__', route: '/careers', component: 'CareersCelanese/By Region/Asia', boardURL: link.href };
}
export function headerFields(doc, scope) {
  const fields = {};
  for (const node of doc.nodes(node => node.tag === 'div' && hasClass(node, 'iCIMS_JobHeaderTag'), scope)) {
    const label = doc.text(oneNative(doc.nodes(node => node.tag === 'dt' && hasClass(node, 'iCIMS_JobHeaderField'), node), 'native header label'));
    const value = doc.text(oneNative(doc.nodes(node => node.tag === 'dd' && hasClass(node, 'iCIMS_JobHeaderData'), node), 'native header value'));
    requireNative(label && value && !Object.hasOwn(fields, label), 'Empty/duplicate native job field'); fields[label] = value;
  }
  return fields;
}
const field = (fields, pattern, required = true) => { const matches = Object.entries(fields).filter(([name]) => pattern.test(name)); requireNative(matches.length <= 1 && (!required || matches.length === 1), 'Missing/ambiguous native ' + pattern.source); return matches[0]?.[1] ?? null; };
export function parseListing(html, url = BOARD) {
  const doc = docOf(html), page = pageNumber(url);
  const scope = oneNative(doc.nodes(node => hasClass(node, 'iCIMS_MainWrapper') && hasClass(node, 'iCIMS_ListingsPage')), 'native listings wrapper');
  const heading = oneNative(doc.nodes(node => node.tag === 'h2' && /^Search Results: Page \d+ of \d+$/.test(doc.text(node)), scope), 'native page-count heading');
  const numbers = /^Search Results: Page (\d+) of (\d+)$/.exec(doc.text(heading)), lastPage = Number(numbers[2]);
  requireNative(Number(numbers[1]) === page && lastPage >= page && lastPage <= 1000, 'Native page count/range mismatch');
  const nav = oneNative(doc.nodes(node => hasClass(node, 'iCIMS_Paging'), scope), 'native pagination');
  const anchors = doc.nodes(node => node.tag === 'a' && node.attrs.href && !hasClass(node, 'invisible'), nav);
  const active = oneNative(anchors.filter(node => hasClass(node, 'selected')), 'active native page');
  requireNative(pageNumber(active.attrs.href) === page && new RegExp('^Page ' + page + ' of ' + lastPage + ' , Current Page$').test(doc.text(active)), 'Active native page mismatch');
  const next = anchors.filter(node => doc.text(node) === 'Next page of results'); requireNative(next.length <= 1, 'Ambiguous native continuation');
  const nextURL = next.length ? next[0].attrs.href : null;
  const last = anchors.filter(node => /^Last page of results\b/.test(doc.text(node))); requireNative(last.length <= 1, 'Ambiguous native last page');
  if (page < lastPage) requireNative(nextURL && pageNumber(nextURL) === page + 1 && last.length === 1 && pageNumber(last[0].attrs.href) === lastPage, 'Missing/noncontiguous native continuation');
  else requireNative(!nextURL, 'Unexpected continuation beyond native last page');
  const cards = doc.nodes(node => node.tag === 'div' && hasClass(node, 'row') && doc.nodes(child => child.tag === 'a' && hasClass(child, 'iCIMS_Anchor') && doc.nodes(child => child.tag === 'h3', child).length === 1, node).length === 1, scope);
  requireNative(cards.length > 0 && cards.length <= 20 && (!nextURL || cards.length === 20), 'Unknown native empty/ragged page');
  const records = [], errors = [];
  for (const card of cards) {
    const rawHTML = doc.outer(card);
    try {
      const anchor = oneNative(doc.nodes(node => node.tag === 'a' && hasClass(node, 'iCIMS_Anchor') && doc.nodes(node => node.tag === 'h3', node).length === 1, card), 'native role anchor');
      const roleURL = anchor.attrs.href, identity = rolePath.exec(validateURL(roleURL).pathname); requireNative(identity, 'Missing native role URL identity');
      const title = doc.text(oneNative(doc.nodes(node => node.tag === 'h3', anchor), 'native role title')), fields = headerFields(doc, card);
      const label = field(fields, /\bJob ID\b/), country = field(fields, /\bCountry\b/, false), city = field(fields, /\bCity\b/);
      requireNative(title && new RegExp('^\\d{4}-' + identity[1] + '$').test(label), 'Native listing Job ID/URL identity mismatch');
      requireNative(!country || nativeCountryName(country), 'Unrecognized explicit listing country');
      records.push({ id: identity[1], title: norm(title), url: roleURL, locations: [city], countries: [country || 'unknown-country'], nativeCountryLabel: country, nativeCityLabel: city, nativeListingJobLabel: label, nativeVisibleHeaderFields: fields, rawListingHTML: rawHTML });
    } catch (error) { errors.push({ message: error.message, rawCandidate: { rawHTML } }); }
  }
  return { records, errors, observedRows: cards.length, pageNumber: page, reportedTotal: null, lastPage, nextURL, terminationKnown: page === lastPage && !nextURL };
}
const contentScope = doc => oneNative(doc.nodes(node => hasClass(node, 'iCIMS_JobContent')), 'native role content');
export function descriptionSections(doc) {
  const scope = contentScope(doc), bodies = doc.nodes(node => node.tag === 'div' && hasClass(node, 'iCIMS_InfoMsg_Job'), scope);
  const headings = doc.nodes(node => node.tag === 'h2', scope).filter(heading => !bodies.some(body => heading.start > body.start && heading.end <= body.end));
  requireNative(bodies.length === 3 && headings.length === 4 && doc.text(headings[3]) === 'Apply 申请:', 'Native description sections changed');
  requireNative(bodies.every(node => doc.text(node)), 'Empty native description section');
  requireNative(bodies.every((body, index) => headings[index].end <= body.start && body.end <= headings[index + 1].start), 'Native description section order changed');
  return bodies.map((node, index) => ({ headingHTML: doc.outer(headings[index]), headingText: doc.text(headings[index]), bodyHTML: doc.inner(node), bodyText: doc.text(node) }));
}
const sectionKeys = html => {
  const doc = docOf(html), headings = doc.nodes(node => node.tag === 'h2' && /^(?:JobOverview综述|Responsibilities职责|Qualifications要求)$/.test(doc.text(node).replace(/:\s*$/, '').replace(/\s+/g, '')));
  requireNative(headings.length === 3 && !plainNativeHTML(html.slice(0, headings[0].start)), 'Unmatched native description prefix/sections');
  // Compare the observed named HTML entities with their literal Unicode form;
  // keep the complete original visible/schema HTML untouched in the output.
  const textKey = value => plainNativeHTML(value).replace(/&(bull|rsquo|reg);/g, (_, name) => ({ bull: '•', rsquo: '’', reg: '®' })[name]).replace(/\s+/g, '');
  return headings.map((node, index) => [doc.text(node).replace(/:\s*$/, '').replace(/\s+/g, ''), textKey(html.slice(node.end, headings[index + 1]?.start ?? html.length))]);
};
export const compareDescriptions = (visible, schema) => {
  const actual = sectionKeys(visible), expected = sectionKeys(schema);
  requireNative(JSON.stringify(actual.map(item => item[0])) === JSON.stringify(['JobOverview综述', 'Responsibilities职责', 'Qualifications要求']), 'Native description heading identity changed');
  return JSON.stringify(actual) === JSON.stringify(expected);
};
const postingConfig = {
  requireSchemaIdentifier: false, acceptedHiringOrganizations: ['Celanese International Corporation'], compareDescriptions, allowedAssetBaseHref: ASSET_BASE,
  visibleTitle: doc => doc.text(oneNative(doc.nodes(node => node.tag === 'h1' && hasClass(node, 'iCIMS_Header'), contentScope(doc)), 'native role title')),
  visibleDescriptionHTML: doc => descriptionSections(doc).map(section => section.headingHTML + '\n' + section.bodyHTML).join('\n'),
  visibleLocations: doc => [field(headerFields(doc, contentScope(doc)), /\bCity\b/)],
  rolePageText: doc => doc.text(contentScope(doc)),
  applicationEvidence: (doc, posting, row) => {
    const links = [...new Set(doc.nodes(node => node.tag === 'a' && node.attrs.href && /^Apply for this job online(?: Apply)?$/.test(doc.text(node)), contentScope(doc)).map(node => { const url = new URL(node.attrs.href); requireNative(url.href === node.attrs.href, 'Noncanonical/relative application URL'); return url.href; }))];
    requireNative(links.length === 1, 'Missing/ambiguous native public application URL');
    const url = new URL(links[0]);
    requireNative(url.origin === ORIGIN && !url.username && !url.password && !url.hash && url.pathname === new URL(row.url).pathname && url.searchParams.getAll('mode').length === 1 && url.searchParams.get('mode') === 'apply' && url.searchParams.getAll('apply').length === 1 && url.searchParams.get('apply') === 'yes' && url.searchParams.getAll('hashed').length === 1 && /^-?\d{1,12}$/.test(url.searchParams.get('hashed')) && (!url.searchParams.has('in_iframe') || url.searchParams.getAll('in_iframe').length === 1 && url.searchParams.get('in_iframe') === '1') && [...url.searchParams.keys()].every(key => ['mode', 'apply', 'hashed', 'in_iframe'].includes(key)), 'Native application/role identity mismatch');
    return { nativeApplicationURL: links[0] };
  },
};
export function parseDetail(html, row) {
  const doc = docOf(html), fields = headerFields(doc, contentScope(doc)), country = nativeCountryName(field(fields, /\bCountry\b/)), city = field(fields, /\bCity\b/);
  requireNative(country, 'Unrecognized explicit visible role country');
  const fact = readNativeJobPosting(html, row, postingConfig);
  requireNative(fact.nativeCountryAddresses.every(address => address.country === country && typeof address.raw.addressLocality === 'string' && norm(address.raw.addressLocality).toLowerCase() === norm(city).toLowerCase()), 'Visible/schema country or city conflict');
  requireNative(fact.nativeCountryAddresses.every(address => address.raw.addressRegion == null || typeof address.raw.addressRegion === 'string'), 'Invalid native state/region type');
  return { ...fact, nativeVisibleHeaderFields: fields, nativeDescriptionSections: descriptionSections(doc), nativeListingJobLabel: row.nativeListingJobLabel, nativeStateRaw: fact.nativeCountryAddresses.map(address => address.raw.addressRegion ?? null), nativeStateSentinelsRemainUnknown: true, nativePublicationProvenance: 'Native JSON-LD datePosted preserved verbatim. A year prefix in listing Job ID is not publication evidence; first-ever publication and date-generation semantics unknown.' };
}
export const CONFIG = {
  source: 'celanese', companyName: 'Celanese', boardURL: BOARD, validateURL, parseListing, parseDetail,
  handoffs: [{ url: CAREERS, verify: verifyCorporateHandoff }],
  sameReadIdentity, resolveReadFrame,
  candidateForIndia: row => row.countries.some(country => nativeCountryName(country) === 'India' || !nativeCountryName(country)),
  pageFingerprint: page => JSON.stringify({ page: page.pageNumber, last: page.lastPage, rows: page.records.map(row => [row.id, row.title, row.url, row.locations, row.countries, row.nativeListingJobLabel]), errors: page.errors }),
};
