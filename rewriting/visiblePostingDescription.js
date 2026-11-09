import { decodeNativeEntities, extractActiveDescription } from '../scraper-support/utils/activeNativeHtml.js';

const normalize = value => decodeNativeEntities(String(value ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();
const profiles = {
  flexsintechnologies: { host: 'www.flexsin.com', company: 'flexsin technologies',
    path: /^\/careers\/(?!post-resume\/?$)[a-z0-9-]+\/?$/i, start: /^job description\s*:?$/i },
  tudiptechnologies: { host: 'tudip.com', company: 'tudip technologies',
    path: /^\/jobs?\/(?:india\/)?[a-z0-9-]+\/?$/i,
    start: /^(?:(?:position|job) summary|roles\s*&\s*responsibilities)\s*:?$/i,
    continueStart: /^roles\s*&\s*responsibilities\s*:?$/i },
  engineersindialimited: { host: 'recruitment.eil.co.in', company: 'engineers india limited', path: /^\/$/ },
  planetspark: { host: 'www.planetspark.in', company: 'planetspark', path: /^\/careers\/?$/ },
  taropumps: { host: 'www.texmo.com', company: 'taro pumps', path: /^\/career-details$/ },
};

export function visiblePostingProfile(job = {}, url = job.sourceUrl || job.applyUrl || job.link) {
  const profile = profiles[job.source];
  // Taro's unverified detail text must not fall back to whole-page experience
  // parsing. The reader below validates its employer, URL and role identity.
  if (job.source === 'taropumps') return profile;
  try {
    const parsed = new URL(url);
    return profile && parsed.protocol === 'https:' && parsed.hostname === profile.host
      && profile.path.test(parsed.pathname) && normalize(job.company) === profile.company ? profile : null;
  } catch { return null; }
}

const advertisementIdentity = job => {
  const identities = [];
  for (const field of ['jobId', 'requisitionId']) {
    const match = String(job[field] ?? '').match(/^eil-hrd-rectt-advt-(\d{4}-\d{2})-(\d+)$/i);
    if (match) identities.push(`HRD/RECTT./ADVT./${match[1]}/${match[2]}`.toUpperCase());
  }
  for (const field of ['applyUrl', 'link']) {
    if (!job[field]) continue;
    try {
      const url = new URL(job[field]);
      const values = url.searchParams.getAll('adv');
      if (values.length > 1) return null;
      if (values.length) {
        if (url.hostname !== 'recruitment.eil.co.in') return null;
        const value = values[0].replace(/\s/g, '').toUpperCase();
        if (!/^HRD\/RECTT\.\/ADVT\.\/\d{4}-\d{2}\/\d+$/.test(value)) return null;
        identities.push(value);
      }
    } catch { return null; }
  }
  return identities.length && new Set(identities).size === 1 ? identities[0] : null;
};

function taroPosting(job, document, url, normalizeTitle) {
  const profile = profiles.taropumps;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.hostname !== profile.host
    || parsed.port || parsed.username || parsed.password || parsed.hash
    || !profile.path.test(parsed.pathname) || normalize(job.company) !== profile.company) return null;
  const ids = parsed.searchParams.getAll('id'), titles = parsed.searchParams.getAll('title');
  if (ids.length !== 1 || !/^[1-9][0-9]*$/.test(ids[0]) || titles.length !== 1
    || normalize(normalizeTitle(titles[0])) !== normalize(normalizeTitle(job.title))) return null;
  const expectedIds = [job.jobId, job.requisitionId].filter(value => value != null);
  if (!expectedIds.length || expectedIds.some(value => !['string', 'number'].includes(typeof value)
    || String(value) !== ids[0])) return null;

  const root = document.nodes(node => node.tag === 'root')[0];
  if (!root) return null;
  const skip = new Set(['script', 'style', 'title', 'nav', 'footer', 'aside']);
  const nodes = [], parents = new Map(), visibleText = [];
  const index = (node, ancestors = []) => {
    if (!node || node.inert || skip.has(node.tag)) return;
    nodes.push(node); parents.set(node, ancestors);
    for (const child of node.children || []) {
      if (typeof child === 'string') visibleText.push(decodeNativeEntities(child));
      else index(child, [...ancestors, node]);
    }
  };
  index(root);
  const headings = nodes.filter(node => /^h[1-6]$/.test(node.tag));
  const roleTitles = headings.filter(node => node.tag === 'h1');
  const starts = headings.filter(node => /^job description\s*:?$/i.test(document.text(node)));
  const hiring = headings.filter(node => /^more information about the hiring team\s*:?$/i.test(document.text(node)));
  // An inline or repeated label cannot establish a structural end boundary.
  const hiringMentions = visibleText.join(' ').replace(/\s+/g, ' ')
    .match(/\bmore information about the hiring team\b/gi) || [];
  if (roleTitles.length !== 1 || normalize(normalizeTitle(document.text(roleTitles[0]))) !== normalize(normalizeTitle(job.title))
    || starts.length !== 1 || hiring.length > 1 || hiringMentions.length !== hiring.length) return null;
  const start = starts[0], end = hiring[0];
  if (nodes.indexOf(roleTitles[0]) >= nodes.indexOf(start)
    || (end && nodes.indexOf(end) <= nodes.indexOf(start))) return null;

  const blocks = new Set(['p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'br', 'tr', 'main']);
  const containers = new Set(['div', 'section', 'article', 'main']);
  // Select the complete heading-to-team interval, even across sibling wrappers.
  // Without that boundary, use the outer explicit role container once; a small
  // heading wrapper must not win while later requirements remain outside it.
  const candidates = end ? [root] : parents.get(start).filter(node => containers.has(node.tag)).slice(0, 1);
  for (const candidate of candidates) {
    const parts = [];
    let started = false, stopped = false, invalid = false;
    const visit = node => {
      if (!node || node.inert || stopped || skip.has(node.tag)) return;
      if (node === end) { stopped = true; return; }
      if (/^h[1-6]$/.test(node.tag)) {
        if (started && /^(?:(?:related|similar|other) (?:jobs|roles|positions|openings)|apply(?: now)?|about (?:us|(?:the )?company)|company (?:overview|profile))\b/i.test(document.text(node))) {
          invalid = true; stopped = true; return;
        }
        if (node === start) started = true;
        if (started) parts.push(`\n${document.text(node)}\n`);
        return;
      }
      if (started && ['form', 'input', 'select', 'textarea', 'button'].includes(node.tag)) {
        invalid = true; stopped = true; return;
      }
      for (const child of node.children || []) {
        if (typeof child === 'string') { if (started && !stopped) parts.push(decodeNativeEntities(child)); }
        else visit(child);
      }
      if (started && blocks.has(node.tag)) parts.push('\n');
    };
    visit(candidate);
    if (invalid) return null;
    const description = parts.join('').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (description.length < 80 || !/\b(?:responsibilities|requirements)\b/i.test(description)) continue;
    if (!extractActiveDescription(description)) return null;
    return { description, evidence: { method: 'exact_texmo_role_visible_sections', url,
      title: job.title, employer: job.company, jobId: ids[0] } };
  }
  return null;
}

function recruitmentNotice(job, document, url, normalizeTitle) {
  const expected = advertisementIdentity(job);
  if (!expected) return null;
  const root = document.nodes(node => node.tag === 'root')[0];
  const text = root ? document.text(root) : '';
  if (!/\bcurrent openings\b/i.test(text)) return null;
  const notices = [...text.matchAll(/(?:^|\s)\d{1,2}\.\s*(.{2,250}?)\s*\(\s*Adv\s+No\s*:\s*(HRD\/RECTT\.\/ADVT\.\/\d{4}-\d{2}\/\d+)\s*\)/gi)];
  const matches = notices.filter(match => match[2].toUpperCase() === expected);
  if (matches.length !== 1 || normalize(normalizeTitle(matches[0][1])) !== normalize(normalizeTitle(job.title))) return null;
  const selected = matches[0];
  const section = [...text.slice(0, selected.index).matchAll(/\bRecruitment\s+of\s+(Experienced|Fresher)\s+Candidates\b/gi)].at(-1)?.[0];
  // A notice summary establishes only its stated recruitment category. Never
  // borrow numeric experience or individual requirements from another notice.
  const description = [section, selected[1].trim(), `Advertisement: ${expected}`].filter(Boolean).join('\n');
  return { description, evidence: { method: 'exact_recruitment_notice', url,
    title: selected[1].trim(), employer: job.company, jobId: expected } };
}

function planetSparkCard(job, document, url, normalizeTitle) {
  const root = document.nodes(node => node.tag === 'root')[0];
  if (!root || !/we['\u2019]?re hiring for these roles/i.test(document.text(root))) return null;
  const cards = [];
  const headingsIn = node => node.inert ? [] : [ ...(node.tag === 'h4' ? [node] : []),
    ...(node.children || []).filter(child => typeof child !== 'string').flatMap(headingsIn) ];
  const visit = (node, ancestors = []) => {
    if (node.inert) return;
    if (node.tag === 'h4' && normalize(normalizeTitle(document.text(node))) === normalize(normalizeTitle(job.title))) {
      const card = [...ancestors].reverse().find(parent => headingsIn(parent).length === 1
        && /\blocation_on\b/.test(document.text(parent)) && /\bcalendar_today\b/.test(document.text(parent))
        && /\bView\s*&\s*Apply\b/i.test(document.text(parent)));
      if (card) cards.push(card);
    }
    for (const child of node.children || []) if (typeof child !== 'string') visit(child, [...ancestors, node]);
  };
  visit(root);
  const field = (text, name) => text.match(new RegExp(`\\b${name}\\s+(.+?)(?=\\s+(?:location_on|calendar_today|access_time|View\\s*&\\s*Apply)\\b|$)`, 'i'))?.[1]?.trim();
  const slug = value => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const matches = cards.map(card => {
    const text = document.text(card), location = field(text, 'location_on'), experience = field(text, 'calendar_today');
    if (!location || !experience) return null;
    const fullLocation = /\bindia\b/i.test(location) ? location : `${location}, India`;
    const id = `planetspark-${slug(`${job.title}-${fullLocation}`)}`;
    const expected = job.requisitionId || job.jobId;
    if (expected ? String(expected) !== id : normalize(job.location) !== normalize(fullLocation)) return null;
    return { id, location: fullLocation, experience, employment: field(text, 'access_time') };
  }).filter(Boolean);
  if (matches.length !== 1) return null;
  const selected = matches[0];
  return { description: [job.title, `Location: ${selected.location}`, `Experience: ${selected.experience}`,
    selected.employment && `Employment type: ${selected.employment}`].filter(Boolean).join('\n'),
    evidence: { method: 'exact_role_card', url, title: job.title, employer: job.company, jobId: selected.id } };
}

export function visiblePostingDescription(job, document, url, { sameUrl, normalizeTitle = value => value } = {}) {
  const profile = visiblePostingProfile(job, url);
  if (!profile) return null;
  const canonical = document.nodes(node => node.tag === 'link'
    && (node.attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canonical.length > 1 || canonical.some(node => !sameUrl(node.attrs.href, url))) return null;
  if (job.source === 'engineersindialimited') return recruitmentNotice(job, document, url, normalizeTitle);
  if (job.source === 'planetspark') return planetSparkCard(job, document, url, normalizeTitle);
  if (job.source === 'taropumps') return taroPosting(job, document, url, normalizeTitle);
  const headings = document.nodes(node => node.tag === 'h1').map(node => document.text(node)).filter(Boolean);
  if (!headings.length || headings.some(title => normalize(normalizeTitle(title)) !== normalize(normalizeTitle(job.title)))) return null;
  const root = document.nodes(node => node.tag === 'root')[0];
  const parts = [];
  const startHeadings = new Set();
  let started = false, stopped = false, seenTitle = false, companyIntro = false, sections = 0;
  const stopHeading = /^(?:join (?:our|the) talent community|(?:submit|send) your application|apply(?: now)?|related (?:jobs|roles|positions)|(?:other|similar) (?:jobs|roles|openings)|about (?:us|(?:the )?company)|company (?:overview|profile)|get in touch|corporate info|service offerings|work culture)\b/i;
  const skip = new Set(['script', 'style', 'title', 'nav', 'header', 'footer', 'aside']);
  const block = new Set(['p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'br', 'tr']);
  const visit = node => {
    if (!node || node.inert || stopped || skip.has(node.tag)) return;
    if (/^h[1-6]$/.test(node.tag)) {
      const text = document.text(node);
      if (node.tag === 'h1') seenTitle = true;
      if (!started && /^(?:about (?:us|(?:the )?company)|company (?:overview|profile))\b/i.test(text)) companyIntro = true;
      if (profile.start.test(text)) {
        const heading = normalize(text);
        if (started && (startHeadings.has(heading) || !profile.continueStart?.test(text))) { stopped = true; return; }
        started = true; startHeadings.add(heading);
      }
      else if (started && stopHeading.test(text)) { stopped = true; return; }
      if (started) { parts.push(`\n${text}\n`); sections++; }
      return;
    }
    if (!started && seenTitle && !companyIntro && ['p', 'div', 'li', 'dt'].includes(node.tag)) {
      const text = document.text(node);
      if (text.length <= 200 && /^(?:(?:minimum|required)(?:\s+(?:professional|work))?\s+experience|experience|employment type|position type)\s*:\s*(?:\d|zero\b|one\b|two\b|three\b|four\b|five\b|freshers?\b|no (?:prior |work )?experience\b|full[- ]?time\b|part[- ]?time\b|contract\b|internship\b|permanent\b|temporary\b|fixed[- ]term\b)/i.test(text)) {
        parts.push(`${text}\n`);
        return;
      }
    }
    if (started && ['form', 'input', 'select', 'textarea', 'button'].includes(node.tag)) { stopped = true; return; }
    for (const child of node.children || []) {
      if (typeof child === 'string') { if (started && !stopped) parts.push(decodeNativeEntities(child)); }
      else visit(child);
    }
    if (started && block.has(node.tag)) parts.push('\n');
  };
  visit(root);
  const description = parts.join('').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (sections < 2 || description.length < 80 || !extractActiveDescription(description)) return null;
  return { description, evidence: { method: 'exact_role_visible_sections', url,
    title: job.title, employer: job.company, jobId: job.jobId ?? job.requisitionId ?? null } };
}
