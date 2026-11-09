import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeLocationCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js';
import { isJobInPublicLocationScope } from '../../src/utils/publicJobLocationScope.js';
export const CAREERS = 'https://www.fynd.com/careers';
export const BOARD = 'https://hiring.fynd.com/careers/gofynd';
export const ORGANIZATION_ID = 'cmkk3z9x80000cur2ssszzqw5';
const token = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value);
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected Fynd base URL'); return doc; };
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Fynd URL type');
  const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search, 'Unapproved Fynd read URL');
  if (url.origin === 'https://www.fynd.com') requireNative(url.pathname.replace(/\/$/, '') === '/careers', 'Unapproved corporate read path');
  else {
    requireNative(url.origin === new URL(BOARD).origin, 'Unapproved Fynd origin');
    const path = url.pathname.replace(/\/$/, '');
    const match = /^\/careers\/gofynd\/jobs\/([A-Za-z0-9_-]{8,100})$/.exec(path);
    requireNative(path === '/careers/gofynd' || match, 'Unapproved job/application read path');
  }
  return url;
}
export const roleURL = publicToken => { requireNative(token(publicToken), 'Invalid public role token'); return BOARD + '/jobs/' + publicToken; };
export function readModel(html) {
  const doc = docOf(html);
  const scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src && /^\s*window\.__INITIAL_DATA__=/.test(node.raw));
  const script = oneNative(scripts, 'native initial data assignment');
  requireNative(!script.attrs.type || ['text/javascript', 'application/javascript'].includes(script.attrs.type), 'Non-executable initial data container');
  const match = /^\s*window\.__INITIAL_DATA__=(\{[\s\S]*\});window\.__SSR_PUBLIC_ROUTE__=true;?\s*$/.exec(script.raw);
  requireNative(match, 'Unreviewed initial-data program or private route');
  let model;
  try { model = JSON.parse(match[1]); } catch { requireNative(false, 'Malformed native JSON literal'); }
  requireNative(model && typeof model === 'object' && !Array.isArray(model), 'Invalid native initial data');
  return model;
}
function verifyTenant(model) {
  const page = model.careerPage, organization = page?.organization;
  requireNative(page?.slug === 'gofynd' && page.externalCareerUrl === CAREERS && organization?.id === ORGANIZATION_ID && organization.name === 'Fynd' && organization.slug === 'gofynd', 'Native Fynd tenant/official backlink mismatch');
}
// The HTML reader marks raw iframe contents inactive. Inspect only the iframe
// element itself, while continuing to exclude inactive ancestors and templates.
export function verifyCorporateHandoff(html) {
  const doc = docOf(html), frames = [];
  const visit = node => {
    if (node.tag === 'iframe') {
      const style = (node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '');
      const hidden = Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert') || node.attrs['aria-hidden'] === 'true' || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(style);
      if (!hidden) frames.push(node);
      return;
    }
    if (node.inactive) return;
    node.children.filter(child => typeof child !== 'string').forEach(visit);
  };
  visit(doc.root);
  const frame = oneNative(frames.filter(node => node.attrs.title === 'Fynd open positions'), 'active official openings iframe');
  requireNative(frame.attrs.src === BOARD, 'Official Fynd iframe target changed');
  return { kind: 'active-native-iframe', target: frame.attrs.src };
}
export function geography(location) {
  requireNative(typeof location === 'string' && location.trim(), 'Missing native location');
  const parts = location.split(',').map(value => value.trim()).filter(Boolean), country = nativeLocationCountryName(location);
  const countryOnly = parts.length === 1 && country;
  return { rawLocation: location, country: country || null, countryCode: null, city: !countryOnly && parts.length > 1 ? parts[0] : !country && !/[;/]/.test(location) ? location.trim() : null, region: country && parts.length >= 3 ? parts.slice(1, -1).join(', ') : null, countryProvenance: country ? 'explicit-native-location-country-label' : 'not-provided', cityCountryNotInferred: true };
}
export function parseListing(html, url = BOARD) {
  requireNative(validateURL(url).pathname.replace(/\/$/, '') === '/careers/gofynd', 'Not the native Fynd board');
  const doc = docOf(html), model = readModel(html); verifyTenant(model);
  requireNative(Array.isArray(model.jobs) && model.jobs.length <= 20000, 'Missing native complete job models');
  const region = oneNative(doc.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby'] === 'open-positions-heading'), 'primary open positions');
  const heading = oneNative(doc.nodes(node => node.tag === 'h2' && node.attrs.id === 'open-positions-heading', region), 'native count heading');
  const totalMatch = /^Open Positions\s*\(\s*(\d+)\s*\)$/.exec(doc.text(heading));
  requireNative(totalMatch, 'Missing native open-position total'); const total = Number(totalMatch[1]);
  requireNative(total <= 20000, 'Native position total bound');
  const continuation = doc.nodes(node => ['a', 'button'].includes(node.tag) && /^(?:next|load more|show more)(?:\s|$)/i.test(doc.text(node)), region);
  const cards = doc.nodes(node => node.tag === 'a' && node.attrs.href, region);
  const records = [], errors = [], used = new Set(), identities = new Set();
  const error = (message, rawCandidate) => errors.push({ message, rawCandidate });
  if (continuation.length) error('Unreviewed server/client continuation', { nativeControlsHTML: continuation.map(node => doc.outer(node)) });
  if (cards.length !== total || model.jobs.length !== total) error('Advertised native total/model/visible card mismatch', { declaredTotal: total, visibleCards: cards.length, modelRows: model.jobs.length });
  for (const native of model.jobs) {
    try {
      requireNative(native && token(native.id) && token(native.publicToken), 'Missing native internal/public identity');
      requireNative(!identities.has(native.id) && !used.has(native.publicToken), 'Duplicate native internal/public identity');
      identities.add(native.id); used.add(native.publicToken);
      const target = roleURL(native.publicToken);
      const anchor = oneNative(cards.filter(node => new URL(node.attrs.href, BOARD).href === target), 'visible native public role link');
      const title = doc.text(oneNative(doc.nodes(node => node.tag === 'h4', anchor), 'primary role title'));
      requireNative(typeof native.title === 'string' && norm(native.title) === title, 'Native model/visible listing title mismatch');
      const labels = doc.nodes(node => node.tag === 'span' && hasClass(node, 'min-w-0') && hasClass(node, 'break-words'), anchor).map(node => doc.text(node));
      requireNative(labels.includes(norm(native.location)), 'Native model/visible listing location mismatch');
      const geo = geography(native.location), publication = nativeDate(native.publishedAt, { required: true });
      records.push({ id: native.id, publicToken: native.publicToken, title, url: target, locations: [native.location], countries: [geo.country || 'unknown-country'], geography: geo, publication, nativeModel: native, rawListingHTML: doc.outer(anchor) });
    } catch (failure) { error(failure.message, { nativeListingModel: native }); }
  }
  for (const anchor of cards) {
    try { const target = new URL(anchor.attrs.href, BOARD); validateURL(target.href); const publicToken = target.pathname.split('/').at(-1); requireNative(used.has(publicToken), 'Visible role has no native listing model'); }
    catch (failure) { error(failure.message, { rawHTML: doc.outer(anchor) }); }
  }
  return { records, errors, observedRows: cards.length, pageNumber: 1, reportedTotal: total, lastPage: 1, nextURL: null, terminationKnown: continuation.length === 0, nativeSerializedJobs: model.jobs.length, carouselExcluded: true };
}
const plainKey = value => norm(value).replace(/\s+/g, '');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const list = (value, name) => {
  if (value == null) return [];
  requireNative(Array.isArray(value) && value.length <= 200 && value.every(item => typeof item === 'string' && item.trim() && item.length <= 20000), 'Invalid native ' + name);
  return value;
};
export function requirementGroups(job) {
  requireNative(Object.hasOwn(job, 'competencies') && Object.hasOwn(job, 'qualifications'), 'Incomplete native qualification/competency fields');
  const competencies = job.competencies;
  if (competencies !== null) requireNative(competencies && typeof competencies === 'object' && !Array.isArray(competencies) && Object.hasOwn(competencies, 'technical') && Object.hasOwn(competencies, 'soft') && Object.keys(competencies).every(key => ['technical', 'soft'].includes(key)), 'Invalid native competency groups');
  const qualifications = job.qualifications;
  if (qualifications !== null) requireNative(qualifications && typeof qualifications === 'object' && !Array.isArray(qualifications) && Object.hasOwn(qualifications, 'required') && Object.hasOwn(qualifications, 'preferred') && Object.keys(qualifications).every(key => ['required', 'preferred'].includes(key)) && Array.isArray(qualifications.required) && Array.isArray(qualifications.preferred), 'Invalid native qualification groups');
  return {
    technical: competencies === null ? [] : list(competencies.technical, 'technical competencies'),
    soft: competencies === null ? [] : list(competencies.soft, 'soft competencies'),
    required: qualifications === null ? [] : list(qualifications.required, 'required qualifications'),
    preferred: qualifications === null ? [] : list(qualifications.preferred, 'preferred qualifications'),
    competenciesExplicitlyNull: competencies === null, qualificationsExplicitlyNull: qualifications === null,
  };
}
export function parseDetail(html, row) {
  const doc = docOf(html), model = readModel(html); verifyTenant(model);
  const job = model.job;
  requireNative(job && job.id === row.id && job.organization?.name === 'Fynd' && job.organization.slug === 'gofynd', 'Native detail identity/employer mismatch');
  requireNative(norm(job.title) === row.title && norm(job.location) === norm(row.nativeModel.location), 'Native listing/detail title or location mismatch');
  const published = nativeDate(job.publishedAt, { required: true });
  requireNative(published.raw === row.publication.raw, 'Listing/detail publication changed');
  const requirements = requirementGroups(job);
  const main = oneNative(doc.nodes(node => node.tag === 'main'), 'native role main');
  const visiblyClosed = /\b(?:this (?:job|position|role) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(doc.text(main));
  const title = oneNative(doc.nodes(node => node.tag === 'h1', main), 'visible role title');
  requireNative(doc.text(title) === row.title, 'Visible/native role title mismatch');
  const header = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'border-b') && doc.nodes(child => child === title, node).length === 1, main), 'visible role header');
  requireNative(doc.nodes(node => node.tag === 'span' && doc.text(node) === norm(job.location), header).length > 0, 'Visible/native role geography mismatch');
  const nativeDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(published.iso));
  requireNative(doc.text(header).includes('Posted ' + nativeDay), 'Visible/native publication day mismatch');
  const content = oneNative(doc.nodes(node => node.tag === 'div' && hasClass(node, 'space-y-6') && doc.nodes(child => child.tag === 'h2' && doc.text(child) === 'Role Overview', node).length === 1, main), 'complete native role content');
  const sections = doc.nodes(node => node.tag === 'section', content);
  const findSection = heading => oneNative(sections.filter(node => doc.nodes(child => child.tag === 'h2' && doc.text(child) === heading, node).length === 1), heading + ' section');
  const about = findSection('About Fynd'), overview = findSection('Role Overview'), responsibilities = findSection('Responsibilities'), benefits = findSection('What do we offer?');
  const qualificationSections = sections.filter(node => doc.nodes(child => child.tag === 'h2' && doc.text(child) === 'Qualifications', node).length === 1);
  requireNative(qualificationSections.length <= 1 && sections.length === 4 + qualificationSections.length, 'Unreviewed native role description sections');
  const expectedQualifications = requirements.required.concat(requirements.preferred);
  if (expectedQualifications.length) requireNative(qualificationSections.length === 1, 'Missing full visible qualifications');
  if (qualificationSections.length) {
    const section = qualificationSections[0];
    const visibleQualifications = doc.nodes(node => node.tag === 'li', section).map(node => doc.text(node));
    requireNative(JSON.stringify(visibleQualifications.map(plainKey)) === JSON.stringify(expectedQualifications.map(plainKey)), 'Visible/native full qualification mismatch');
    const expectedHeadings = [...(requirements.required.length ? ['Required'] : []), ...(requirements.preferred.length ? ['Preferred'] : [])];
    requireNative(JSON.stringify(doc.nodes(node => node.tag === 'h3', section).map(node => doc.text(node))) === JSON.stringify(expectedHeadings), 'Visible/native qualification group heading mismatch');
  }
  requireNative(typeof job.outcome === 'string' && job.outcome.trim().length >= 100, 'Missing full native role overview');
  const overviewBody = oneNative(doc.nodes(node => node.tag === 'p', overview), 'native overview text');
  requireNative(plainKey(doc.text(overviewBody)) === plainKey(job.outcome), 'Visible/native overview mismatch');
  const nativeResponsibilities = list(job.responsibilities, 'responsibilities');
  const visibleResponsibilities = doc.nodes(node => node.tag === 'li', responsibilities).map(node => doc.text(node));
  requireNative(nativeResponsibilities.length > 0 && JSON.stringify(visibleResponsibilities.map(plainKey)) === JSON.stringify(nativeResponsibilities.map(plainKey)), 'Visible/native full responsibilities mismatch');
  requireNative(typeof model.careerPage.aboutCompany === 'string' && doc.text(about).endsWith(norm(model.careerPage.aboutCompany)), 'Visible/native full company description mismatch');
  const nativeBenefits = model.careerPage.benefits;
  requireNative(nativeBenefits && Array.isArray(nativeBenefits.sections), 'Missing native company benefits');
  const benefitHeadings = doc.nodes(node => node.tag === 'h3', benefits).map(node => doc.text(node));
  requireNative(benefitHeadings.length === nativeBenefits.sections.length, 'Visible/native benefit section count mismatch');
  for (const entry of nativeBenefits.sections) {
    requireNative(typeof entry.title === 'string' && typeof entry.content === 'string', 'Malformed native benefit');
    requireNative(benefitHeadings.includes(norm(entry.title)), 'Visible/native benefit heading mismatch');
    // The observed page preserves text bullets and meaningful hyphens.
    const expected = plainKey(entry.content);
    requireNative(plainKey(doc.text(benefits)).includes(expected), 'Visible/native complete benefit mismatch');
  }
  requireNative(typeof nativeBenefits.closingLine === 'string' && doc.text(benefits).endsWith(norm(nativeBenefits.closingLine)), 'Visible/native benefit closing text mismatch');
  const nextSteps = oneNative(doc.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby'] === 'application-next-steps', main), 'native application next steps');
  const supplemental = [];
  for (const [heading, values] of [['Technical competencies', requirements.technical], ['Soft competencies', requirements.soft]]) {
    const missingVisible = values.filter(value => !doc.nodes(node => ['p', 'li'].includes(node.tag) && plainKey(doc.text(node)) === plainKey(value), content).length);
    if (missingVisible.length) supplemental.push({ heading, values: missingVisible });
  }
  const supplementalHTML = supplemental.map(section => '<h2>' + escape(section.heading) + '</h2><ul>' + section.values.map(value => '<li>' + escape(value) + '</li>').join('') + '</ul>').join('\n');
  const visibleDescriptionHTML = sections.map(node => doc.outer(node)).concat(doc.outer(nextSteps)).join('\n');
  const descriptionHTML = [visibleDescriptionHTML, supplementalHTML].filter(Boolean).join('\n');
  const applications = [...new Set(doc.nodes(node => node.tag === 'a' && doc.text(node) === 'Apply Now' && node.attrs.href, content).map(node => new URL(node.attrs.href, row.url).href))];
  requireNative(applications.length === 1, 'Missing/ambiguous native application handoff');
  const application = new URL(applications[0]);
  requireNative(application.origin === new URL(BOARD).origin && application.pathname === '/candidate/login' && !application.username && !application.password && !application.hash && application.searchParams.getAll('redirect').length === 1 && [...application.searchParams.keys()].length === 1 && application.searchParams.get('redirect') === '/candidate/jobs/' + job.id + '/apply', 'Native application/internal identity mismatch');
  requireNative(typeof job.status === 'string' && typeof job.applyAllowed === 'boolean', 'Missing native lifecycle/application flags');
  const fact = { id: job.id, publicToken: row.publicToken, title: row.title, sourceURL: row.url, nativeListingRecord: row.nativeModel, nativeJob: job, nativeCareerPage: model.careerPage, nativeGeography: geography(job.location), nativePublication: published, nativeVisibleDescriptionHTML: visibleDescriptionHTML, nativeQualificationGroups: requirements, nativeSupplementalQualifications: supplemental, nativeSupplementalQualificationsHTML: supplementalHTML, descriptionHTML, nativeApplicationURL: application.href, applicationVisited: false, nativeRawRoleHTML: html, nativeVisiblePublicationDay: nativeDay, sourceScopeComplete: false, firstEverPublication: null, legalEmployer: null };
  if (visiblyClosed) return { ...fact, excluded: true, exclusionReason: 'native-visible-role-closed' };
  if (job.status !== 'PUBLISHED' || !job.applyAllowed) return { ...fact, excluded: true, exclusionReason: 'native-role-not-published-or-application-disabled' };
  if (fact.nativeGeography.country && fact.nativeGeography.country !== 'India' || !isJobInPublicLocationScope({ location: job.location, country: fact.nativeGeography.country, city: fact.nativeGeography.city })) return { ...fact, excluded: true, exclusionReason: 'outside-existing-public-location-scope' };
  return fact;
}
export const CONFIG = {
  source: 'fynd', companyName: 'Fynd', boardURL: BOARD, validateURL, parseListing, parseDetail,
  handoffs: [{ url: CAREERS, verify: verifyCorporateHandoff }],
  sameReadIdentity: (left, right) => { const a = validateURL(left), b = validateURL(right); return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, ''); },
  candidateForIndia: row => !row.geography.country || row.geography.country === 'India',
  pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, models: page.nativeSerializedJobs, rows: page.records.map(row => [row.id, row.publicToken, row.title, row.locations, row.publication.raw]), errors: page.errors }),
};
