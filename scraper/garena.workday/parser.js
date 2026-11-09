import { decodeNuxt } from './literal.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js';

export const HOME = 'https://intl.garena.com/';
export const CAREERS_ROOT = 'https://careers.garena.com/';
// Captured native redirect's final HTTPS target. Do not follow its HTTP downgrade.
export const PORTAL = 'https://careers.garena.com/global/';
export const BOARD = 'https://careers.garena.com/global/careers';
export const requireNative = (condition, message) => { if (!condition) throw Object.assign(Error(message), { code: 'GARENA_SOURCE_SHAPE' }); };
const one = (values, name) => { requireNative(values.length === 1, 'Missing/ambiguous ' + name); return values[0]; };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const text = value => typeof value === 'string' && value.trim().length > 0;
const classes = node => (node.attrs.class || '').split(/\s+/);
export const detailURL = id => { requireNative(/^J\d{8}$/.test(id), 'Invalid native job ID'); return BOARD + '/' + id; };

function htmlDocument(html) {
  requireNative(typeof html === 'string' && Buffer.byteLength(html) <= 2 * 1024 * 1024, 'Invalid bounded HTML');
  const doc = document(html);
  requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected HTML base');
  return doc;
}
export function verifyHandoff(homeHTML, portalHTML) {
  const home = htmlDocument(homeHTML), portal = htmlDocument(portalHTML);
  const urls = (doc, base) => doc.nodes(node => node.tag === 'a' && node.attrs.href).map(node => {
    try { return new URL(node.attrs.href, base).href; } catch { return null; }
  });
  requireNative(urls(home, HOME).includes(CAREERS_ROOT), 'Corporate careers handoff missing');
  requireNative(urls(portal, PORTAL).includes(BOARD), 'Native global careers handoff missing');
  return { corporateAdvertisedCareersRoot: CAREERS_ROOT, canonicalHTTPSPortal: PORTAL, boardURL: BOARD, scope: 'Garena brand portal; legal employer and Sea/group inventory equivalence unknown' };
}
export function pageModel(html, routePath) {
  const doc = htmlDocument(html);
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src && (node.raw || '').includes('window.__NUXT__='));
  const model = decodeNuxt(one(scripts, 'native Nuxt bootstrap').raw);
  requireNative(model.serverRendered === true && model.routePath?.replace(/\/$/, '') === routePath && model.state?.Event?.currentOffice === 'global', 'Native route/office identity mismatch');
  requireNative(model.config?.ATS_HOST === 'https://ats.workatsea.com', 'Native advertised ATS identity changed');
  return { model, doc };
}
export function validateRecord(record) {
  requireNative(record && typeof record === 'object' && !Array.isArray(record) && /^J\d{8}$/.test(record.id) && text(record.title), 'Malformed native job identity');
  requireNative(record.tags && typeof record.tags === 'object' && !Array.isArray(record.tags), 'Missing native tags');
  requireNative(Object.keys(record.tags).every(key => ['location', 'jobCategory', 'jobType'].includes(key)), 'Unreviewed native location/tag fields');
  for (const key of ['location', 'jobCategory', 'jobType']) {
    const values = record.tags[key];
    requireNative(Array.isArray(values) && values.length <= 32 && values.every(text) && new Set(values).size === values.length, 'Malformed native ' + key);
  }
  requireNative(record.tags.location.length > 0 && record.tags.jobType.length > 0 && typeof record.description === 'string', 'Missing native location/type/description field');
  for (const key of ['country', 'countryCode', 'datePosted', 'postingDate', 'closed', 'status']) requireNative(!Object.hasOwn(record, key), 'Unreviewed native job field: ' + key);
  return record;
}
export function parseListing(html) {
  const { model, doc } = pageModel(html, '/global/careers');
  const records = model.state.Job?.jobList;
  requireNative(Array.isArray(records) && records.length <= 2000, 'Missing/bounded serialized job inventory');
  const ids = new Set();
  for (const record of records) { validateRecord(record); requireNative(!ids.has(record.id), 'Duplicate native job ID'); ids.add(record.id); }
  const cards = doc.nodes(node => node.tag === 'a' && classes(node).includes('job-item'));
  requireNative(cards.length === Math.min(10, records.length), 'SSR first page/serialized inventory mismatch');
  cards.forEach((card, index) => {
    const title = one(doc.nodes(node => node.tag === 'div' && classes(node).includes('title'), card), 'SSR role title');
    requireNative(new URL(card.attrs.href, PORTAL).href === detailURL(records[index].id) && doc.text(title) === records[index].title, 'SSR/native inventory identity mismatch');
  });
  const pageNodes = doc.nodes(node => node.tag === 'div' && classes(node).includes('page-desc'));
  const pageText = pageNodes.length ? doc.text(one(pageNodes, 'native page count')) : null;
  if (records.length) requireNative(pageText === '1 of ' + Math.ceil(records.length / 10), 'Client pagination/serialized inventory mismatch');
  const categoryAmounts = model.state.Job?.jobFilters?.jobCategory;
  const categoryAdvertisedSum = Array.isArray(categoryAmounts) && categoryAmounts.every(row => Number.isSafeInteger(row.amount) && row.amount >= 0)
    ? categoryAmounts.reduce((sum, row) => sum + row.amount, 0) : null;
  return { records, serializedRecordCount: records.length, uiFirstPageCards: cards.length, uiPageCount: records.length ? Math.ceil(records.length / 10) : null, categoryAdvertisedSum, categoryCountDifference: categoryAdvertisedSum === null ? null : records.length - categoryAdvertisedSum, wholeCompanyScope: false };
}
export function parseDetail(html, listingRecord) {
  const { model, doc } = pageModel(html, '/global/careers/' + listingRecord.id);
  const role = validateRecord(model.state.Job?.jobDetail);
  requireNative(role.id === listingRecord.id && role.title === listingRecord.title && same(role.tags, listingRecord.tags), 'Listing/detail identity or location changed');
  const rolePage = one(doc.nodes(node => node.tag === 'div' && classes(node).includes('job-detail-page')), 'native role page');
  requireNative(!/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(doc.text(rolePage)), 'Native role visibly closed');
  const heading = one(doc.nodes(node => node.tag === 'h3' && classes(node).includes('job-title')), 'native detail heading');
  requireNative(doc.text(heading) === role.title, 'Visible/detail title mismatch');
  requireNative(typeof role.jobDescription === 'string' && typeof role.jobRequirements === 'string' && hasSourceDescription({ jobDescription: role.jobDescription }) && hasSourceDescription({ jobDescription: role.jobRequirements }), 'Missing full native description/requirements');
  const content = one(doc.nodes(node => node.tag === 'div' && classes(node).includes('job-content')), 'visible role content');
  const tags = one(doc.nodes(node => node.tag === 'div' && classes(node).includes('tags'), content), 'visible location/type tags');
  const visibleTags = doc.nodes(node => node.tag === 'span', tags).map(node => doc.text(node));
  requireNative(same(visibleTags, [...role.tags.location, ...role.tags.jobCategory, ...role.tags.jobType]), 'Visible/native location or tag mismatch');
  const description = one(doc.nodes(node => node.tag === 'div' && classes(node).includes('more-desc-box'), content), 'visible full description');
  const plain = html => { const fragment = document(html); return fragment.text(fragment.root); };
  const expectedText = 'Job Description ' + plain(role.jobDescription) + ' Job Requirements ' + plain(role.jobRequirements);
  requireNative(doc.text(description) === expectedText, 'Visible/native full description mismatch');
  let nativeApplicationURL = null;
  if (role.applyUrl !== null && role.applyUrl !== '') {
    requireNative(typeof role.applyUrl === 'string', 'Malformed native application URL');
    const url = new URL(role.applyUrl);
    requireNative(url.protocol === 'https:' && url.origin === model.config.ATS_HOST && !url.username && !url.password, 'Unapproved native application URL');
    nativeApplicationURL = role.applyUrl;
  }
  return { id: role.id, title: role.title, nativeTags: role.tags, nativeListingRecord: listingRecord, nativeDetailRecord: role, nativeJobDescriptionHTML: role.jobDescription, nativeJobRequirementsHTML: role.jobRequirements, nativeApplicationURL, applicationVisited: false, nativeCountryRaw: null, nativeCountryCode: null, sourcePublicationDate: null, firstEverPublication: null, sourceDeadline: null, explicitLifecycleStatus: null, legalEmployer: null, sourceURL: detailURL(role.id) };
}
