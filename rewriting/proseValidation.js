// Conservative lexical evidence checks, not a semantic-equivalence score.
import { collapsedDescriptionHeadings, descriptionHeadingNames } from '../src/utils/jobDescriptionStructure.js';
import { recoverDescriptionLayout } from '../src/utils/jobDescriptionLayout.js';
// Independent statements may move; protected relationships within them may not.
const required = /\b(?:must|requir(?:e[sd]?|ing)|mandatory|minimum|at least|essential|necessary)\b/i;
const preferred = /\b(?:preferred|preferable|desirable|optional|(?:nice|good)[\s-]+to[\s-]+have|a plus)\b/i;
const negative = /\b(?:no|not|never|without|cannot)\b|\b\w+n['’]t\b/i;
export const proseHeadingNames = descriptionHeadingNames + '|role overview|about (?:us|the role|the company)|(?:main |core (?:job )?|key |job )?responsibilities|primary job function|main purpose of (?:the )?role|job description|duties|required(?: qualifications| skills| requirements| experience)?|must[\\s-]+have(?: skills)?|minimum qualifications|basic qualifications|qualifications|requirements|skills|preferred(?: qualifications| skills| requirements)?|(?:nice|good)[\\s-]+to[\\s-]+have|benefits|employment details|application details';
const heading = new RegExp('^(?:#{1,6}\\s*)?(' + proseHeadingNames + ')\\s*(?::|[-–](?=\\s|$)|$)', 'i');
export const proseSectionRole = title => preferred.test(title || '') ? 'preferred'
  : /required|mandatory|must[\s-]+have|minimum|basic|qualification|requirement|^(?:technical )?skills$/i.test(title || '') ? 'required' : 'neutral';
// One heading grammar serves statement checks, block planning and the terminal
// scope guard, including Markdown bold and list markers.
const explicitProseHeadings = source => [...source.matchAll(new RegExp(
  '(?<!\\S)(?:(?<=^|\\n)[ \\t]*(?:[-*•]|\\d+[.)])[ \\t]+)?(?:#{1,6}[ \\t]*)?(?:\\*\\*|__)?('
  + proseHeadingNames + ')[ \\t]*(?:\\*\\*|__)?[ \\t]*(?::|[-–](?=[ \\t\\n]|$)|(?=\\n|$))(?:\\*\\*|__)?[ \\t]*', 'gi'))]
  .filter(match => /[:–-][ \t]*$/.test(match[0].replace(/\*\*|__/g, ''))
    || !source.slice(source.lastIndexOf('\n', match.index - 1) + 1, match.index).trim())
  .map(match => ({ start: match.index, end: match.index + match[0].length, title: match[1], kind: 'heading' }));
export const proseHeadings = source => {
  const headings = explicitProseHeadings(source);
  for (const heading of collapsedDescriptionHeadings(source)) {
    if (!headings.some(existing => existing.start <= heading.start && existing.end >= heading.start)) headings.push(heading);
  }
  return headings.sort((left, right) => left.start - right.start);
};
const filler = new Set('a an the is are be been being of for to with in on at by as this that these those have has also please qualifications qualification requirements requirement skills skill required mandatory requires require essential necessary preferred preferable desirable optional nice good plus'.split(' '));
const aliases = new Map(Object.entries({ develop: 'build', develops: 'build', developing: 'build', builds: 'build', building: 'build',
  maintains: 'maintain', maintaining: 'maintain', designing: 'design', supporting: 'support', dependable: 'reliable', duties: 'responsibilities',
  seeking: 'seek', managing: 'manage', reviewing: 'review', documenting: 'document', testing: 'test', implementing: 'implement', planning: 'plan', coordinating: 'coordinate' }));
const numberWords = new Map('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ').map((word, n) => [word, String(n)]));
const units = { '$': 'currency-dollar', '€': 'currency-euro', '£': 'currency-pound', '₹': 'currency-rupee', '¥': 'currency-yen', '%': 'percent' };
const normalize = text => text.toLowerCase().replace(/\*\*|__/g, '')
  .replace(/\bwe are (?:currently )?looking for\b/g, 'we seek')
  .replace(/\byou will be responsible for\b/g, 'you will')
  .replace(/\b(?:are|is) required to\b/g, 'must')
  .replace(/\bpossess\b/g, 'have')
  .replace(/\b(nice|good)[\s-]+to[\s-]+have\b/g, '$1 to have')
  .replace(/^(?:the|this) role (?:focuses on|involves)\s+(?=(?:building|developing|maintaining|designing|supporting)\b)/, '')
  .replace(/[$€£₹¥%]/g, symbol => ' ' + units[symbol] + ' ')
  .replace(/(?<![\p{L}\p{N}])[-−](?=\d)/gu, ' negative ')
  .replace(/\bwork with\b/g, 'collaborate with')
  .replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, value => value.replaceAll(',', ''))
  .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g, word => numberWords.get(word))
  .replace(/\b(?:at least|no less than|minimum(?: of)?)\b|>=|≥/g, ' gte ')
  .replace(/\b(?:at most|no more than|maximum(?: of)?|up to)\b|<=|≤/g, ' lte ')
  .replace(/\b(?:more than|greater than)\b|>/g, ' gt ')
  .replace(/\b(?:less than|fewer than)\b|</g, ' lt ')
  .replace(/(\d+(?:\.\d+)?)\+/g, ' gte $1 ');
const terms = (text, boundaries = false) => (normalize(text).match(boundaries
  ? /\d+(?:\.\d+)*|[\p{L}][\p{L}\p{N}+#'-]*|[.!?;]/gu
  : /\d+(?:\.\d+)*|[\p{L}][\p{L}\p{N}+#'-]*/gu) || [])
  .filter(word => !filler.has(word))
  .map(word => aliases.get(word) || (word.length > 3 && word.endsWith('s') && !/(?:ss|us|is)$/.test(word) ? word.slice(0, -1) : word));

const statements = (text, inheritedRole = 'neutral') => {
  text = recoverDescriptionLayout(text).text;
  // Normalize only reproduced editorial seams, never arbitrary repeated facts
  // or sentence boundaries (which can attach a duty to a different actor).
  text = text.replace(/\b(The work model for the role is:)[ \t]+(?:The work model for the role is:[ \t]+)+/gi, '$1 ')
    .replace(/\b(Recruitment Fraud Warning)\.[ \t\n]+(?=\S)/g, '$1: ');
  const result = [];
  let role = inheritedRole;
  const pieces = [];
  let offset = 0;
  for (const title of proseHeadings(text)) {
    const prefix = text.slice(offset, title.start);
    // Do not manufacture a blank paragraph before an already separated heading.
    pieces.push(prefix, prefix.endsWith('\n') ? '' : '\n', text.slice(title.start, title.end));
    offset = title.end;
  }
  const marked = (pieces.join('') + text.slice(offset)).replace(/\n[ \t]+(?=\n)/g, '\n');
  const fragments = marked.split(/(\n+|(?<=[.!?])\s+(?=[\p{Lu}]))/u);
  for (let index = 0; index < fragments.length; index += 2) {
    let fragment = fragments[index];
    const paragraphEnd = index === fragments.length - 1 || /\n\n/.test(fragments[index + 1]);
    fragment = fragment.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*|__/g, '').trim();
    const title = fragment.match(heading);
    if (title) {
      role = proseSectionRole(title[1]);
      fragment = fragment.slice(title[0].length).trim();
    }
    if (!fragment) continue;
    // Split coordinated bare duties, never a shared negation or modal whose
    // scope across the conjunction would require guessing.
    const clauses = /\b(?:must|can|could|may|might|will|shall)\b/i.test(fragment) || negative.test(fragment) ? [fragment]
      : fragment.split(/\s+and\s+(?=(?:build|develop|maintain|design|collaborate|support|create|manage|lead|implement|deliver|ensure|work|write|analyze|test|review|monitor|document|coordinate|provide|assist|improve)\b)/i);
    for (const [clauseIndex, clause] of clauses.entries()) {
      const tokens = terms(clause);
      if (!tokens.length) continue;
      const explicitRole = preferred.test(clause) ? 'preferred' : required.test(clause) ? 'required' : role;
      const modality = /\b(?:can|could|may|might)\b/i.test(clause) ? 'permission'
        : /\b(?:will|shall)\b/i.test(clause) ? 'commitment'
          : /\b(?:must|required|mandatory|necessary|essential)\b/i.test(clause) || explicitRole === 'required' ? 'obligation' : 'neutral';
      result.push({ text: clause, tokens, layoutTokens: terms(clause, true), role: explicitRole, modality,
        paragraphEnd: paragraphEnd && clauseIndex === clauses.length - 1,
        continued: clauseIndex === clauses.length - 1 && /^\n$/.test(fragments[index + 1] || '')
          && Boolean(fragments[index + 2]?.trim()) && !/^\s*(?:[-*•]|\d+[.)])\s+/.test(fragments[index + 2]),
        negative: negative.test(clause.replace(/\bno (?:less|more) than\b/gi, '')),
        numbers: normalize(clause).match(/\d+(?:\.\d+)*/g) || [] });
    }
  }
  return result;
};
const numericContexts = unit => unit.tokens.flatMap((token, index) =>
  [...token.matchAll(/\d+(?:\.\d+)*/g)].map(match => ({ value: match[0], before: unit.tokens[index - 1], after: unit.tokens[index + 1] })));
const numericRelationshipChanged = (original, candidate) => {
  if (JSON.stringify(original.numbers) !== JSON.stringify(candidate.numbers)) return true;
  if (!original.numbers.length) return false;
  const expected = numericContexts(original), actual = numericContexts(candidate);
  // Preserve numeric neighbors, including subjects, units, signs and comparisons.
  // Unrelated lexical differences still fail the complete statement check below;
  // they must not all be diagnosed as changed numeric facts.
  return expected.length !== actual.length || expected.some((item, index) => item.value !== actual[index].value
    || (item.before !== undefined && item.before !== actual[index].before)
    || (item.after !== undefined && item.after !== actual[index].after));
};
const signature = unit => JSON.stringify([unit.role, unit.modality, unit.negative,
  // Terminal punctuation may change with bullet formatting. Internal sentence
  // boundaries must stay attached to their terms even in glued ATS prose.
  unit.layoutTokens.filter((token, index, tokens) => index !== tokens.length - 1 || !/^[.!?;]$/.test(token))]);
const anchorTerms = unit => new Set(unit.tokens.filter(token => !/^\d/.test(token) && !['gte', 'lte', 'gt', 'lt'].includes(token)));
const punctuation = token => /^[.!?;]$/.test(token);
const layoutGroups = units => {
  const groups = [];
  for (const unit of units) {
    const scope = JSON.stringify([unit.role, unit.modality, unit.negative]);
    let group = groups.at(-1);
    if (group?.scope !== scope) {
      group = { scope, tokens: [], ends: new Set(), boundaries: new Set(), punctuated: new Set(), words: 0 };
      groups.push(group);
    }
    for (const token of unit.layoutTokens) {
      group.tokens.push(token);
      if (!punctuation(token)) group.words++;
      else group.punctuated.add(group.words);
    }
    group.ends.add(group.tokens.length - 1);
    if (unit.paragraphEnd) group.boundaries.add(group.words);
  }
  return groups;
};
const layoutSignature = (units, originals) => {
  const sourceGroups = layoutGroups(originals);
  return JSON.stringify(layoutGroups(units).map((group, index) => {
    const source = sourceGroups[index];
    let words = 0;
    return { scope: group.scope, tokens: group.tokens.filter((token, position) => {
      if (!punctuation(token)) { words++; return true; }
      // Ignore only an ADDED full stop at an explicit source paragraph end.
      // Original punctuation stays mandatory; a soft wrap can be mid-clause.
      return !(token === '.' && group.ends.has(position) && source?.scope === group.scope
        && source.boundaries.has(words) && !source.punctuated.has(words));
    }) };
  }));
};

export const checkProseStatements = (source, text, { sectionContext } = {}) => {
  const inheritedRole = proseSectionRole(sectionContext);
  const originals = statements(source, inheritedRole), rewritten = statements(text, inheritedRole);
  // Ordered words, scope and internal sentence boundaries must agree. Only the
  // original's blank paragraphs/end can make a terminal full stop optional.
  if (layoutSignature(originals, originals) === layoutSignature(rewritten, originals)) return { reason: null };
  const available = new Map(), consumed = new Set(), unmatched = [];
  rewritten.forEach((unit, index) => {
    const key = signature(unit);
    if (!available.has(key)) available.set(key, []);
    available.get(key).push(index);
  });
  // Match exact canonical facts first so reordering cannot steal a better match.
  for (const unit of originals) {
    const matches = available.get(signature(unit));
    const compatible = matches?.findIndex(index => !unit.continued
      || !punctuation(rewritten[index].layoutTokens.at(-1)) || punctuation(unit.layoutTokens.at(-1)));
    if (compatible >= 0) consumed.add(matches.splice(compatible, 1)[0]);
    else unmatched.push(unit);
  }
  const fail = (reason, original, candidate) => ({ reason, diagnostic: { code: reason,
    evidence: original?.text?.slice(0, 1800), text: candidate?.text?.slice(0, 1200), scope: original?.role } });
  for (const original of unmatched) {
    const anchors = anchorTerms(original);
    let best, bestScore = 0;
    for (let i = 0; i < rewritten.length; i++) {
      if (consumed.has(i)) continue;
      const candidateAnchors = anchorTerms(rewritten[i]);
      const overlap = [...anchors].filter(token => candidateAnchors.has(token)).length;
      const score = overlap / Math.max(anchors.size, candidateAnchors.size, 1);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    if (best === undefined) return fail('source_details_changed', original);
    const candidate = rewritten[best];
    if (original.negative !== candidate.negative) return fail('negation_changed', original, candidate);
    // Report the factual numeric relationship before keyword side effects.
    if (numericRelationshipChanged(original, candidate)) return fail('numeric_relationship_changed', original, candidate);
    if (original.role !== candidate.role) return fail(original.role === 'preferred' ? 'preferred_scope_changed' : 'required_scope_changed', original, candidate);
    if (original.modality !== candidate.modality) return fail(original.role === 'required' ? 'required_scope_changed' : 'source_details_changed', original, candidate);
    return fail('source_details_changed', original, candidate);
  }
  if (consumed.size !== rewritten.length) return fail('unsupported_claim', undefined, rewritten.find((_unit, index) => !consumed.has(index)));
  return { reason: null };
};
