import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';
import { resumeFailure } from './resumeDiagnostics.js';

export const RESUME_PIPELINE_POLICY = 'abey-pagination-v2';
export const PAGINATION_REPAIR_MAX_TOKENS = 128;
const paginationSchema = {
  type: 'object', additionalProperties: false, required: ['spacing', 'breakBefore'],
  properties: {
    spacing: { type: 'string', enum: ['original', 'compact'] },
    breakBefore: { anyOf: [{ type: 'integer', minimum: 0, maximum: 127 }, { type: 'null' }] },
  },
};

export function paginationRepairSchema(pagination, breakIds) {
  if (!Array.isArray(breakIds)) return paginationSchema;
  if (breakIds.length > 128 || breakIds.some(id => !Number.isInteger(id) || id < 0 || id > 127)) throw resumeFailure('pagination_repair_invalid');
  const requiredBreak = pagination?.exact && pagination.targetPages === 2;
  if (requiredBreak && !breakIds.length) throw resumeFailure('pagination_repair_invalid');
  const integer = { type: 'integer', enum: breakIds };
  const breakBefore = pagination?.targetPages === 1 || !breakIds.length ? { type: 'null' }
    : requiredBreak ? integer : { anyOf: [integer, { type: 'null' }] };
  return { ...paginationSchema, properties: { ...paginationSchema.properties, breakBefore } };
}

const entries = new Set(['resumeSubheading', 'resumeSubSubheading', 'resumeProjectHeading']);
const items = new Set(['resumeItem', 'resumeSubItem', 'item', 'classesList']);
const listStarts = new Map([['resumeSubHeadingListStart', 'heading'], ['resumeItemListStart', 'item']]);
const listEnds = new Map([['resumeSubHeadingListEnd', 'heading'], ['resumeItemListEnd', 'item']]);

function listOptions(body, start) {
  const gap = body.slice(start).match(/^(?:\s|%[^\r\n]*(?:\r?\n|$))*/)[0];
  const open = start + gap.length;
  if (body[open] !== '[') return null;
  let depth = 0;
  for (const match of body.slice(open + 1).matchAll(/%[^\r\n]*|\\(?:[A-Za-z]+|[^\r\n])|[{}\]]/g)) {
    if (match[0] === '{') depth++;
    else if (match[0] === '}') depth--;
    else if (match[0] === ']' && depth === 0) {
      const close = open + 1 + match.index;
      return { prefix: gap, options: body.slice(open + 1, close), end: close + 1 };
    }
  }
  return null;
}

// The document has already compiled. Still scan comments, escaped symbols and
// brace groups: a command inside candidate text must never become an edit target.
function layoutTokens(body) {
  const tokens = [], stack = [];
  let depth = 0, opaqueUntil = 0;
  for (const match of body.matchAll(/%[^\r\n]*|\\(begin|end)\s*\{([^}]+)\}|\\([A-Za-z]+|[^\r\n])|[{}]/g)) {
    if (match.index < opaqueUntil) continue;
    const value = match[0];
    if (value[0] === '%') continue;
    if (value === '{') { depth++; continue; }
    if (value === '}') { depth--; continue; }
    if (depth !== 0) continue;
    const token = { index: match.index, end: match.index + value.length, command: match[3],
      environment: match[2], direction: match[1], stack: [...stack] };
    if (token.command === 'resumeItemListStart') {
      const options = listOptions(body, token.end);
      token.options = options?.options || '';
      token.optionsPrefix = options?.prefix || '';
      if (options) { token.end = options.end; opaqueUntil = token.end; }
    }
    tokens.push(token);
    if (listStarts.has(token.command)) {
      token.kind = listStarts.get(token.command);
      token.members = [];
      stack.push(token);
    } else if (listEnds.has(token.command)) {
      const start = stack.pop();
      if (start?.kind !== listEnds.get(token.command)) return null;
      start.close = token;
    } else if (match[1] && match[2] !== 'document') {
      if (match[1] === 'begin') stack.push({ kind: 'environment', name: match[2] });
      else if (stack.pop()?.name !== match[2]) return null;
    }
    if ((entries.has(token.command) || items.has(token.command)) && stack.at(-1)?.members) stack.at(-1).members.push(token);
  }
  return depth === 0 && !stack.length ? tokens : null;
}

function compactOptions(options) {
  // enumitem applies the final key value. Retaining all original option bytes
  // protects labels and comments containing commas or spacing-looking text.
  return (options ? `${options},` : '') + 'itemsep=0pt,parsep=0pt,topsep=0pt,partopsep=0pt';
}

export function buildPaginationRepairPlan(latex, pagination, { pageCount } = {}) {
  if (!latex.startsWith(RESUME_LATEX_PREAMBLE)) return null;
  const body = latex.slice(RESUME_LATEX_PREAMBLE.length);
  const tokens = layoutTokens(body);
  if (!tokens) return null;
  const headerEnd = tokens.find(token => token.direction === 'end' && token.environment === 'center')?.end;
  if (!headerEnd) return null;
  const changes = [], choices = [];
  let units = 0, awaitingSectionContent = true;
  for (const token of tokens) {
    if (token.index < headerEnd) continue;
    const { command, stack } = token;
    if (!stack.length && command === 'section' && units) choices.push({ token, kind: 'section' });
    if (!stack.length && command === 'section') awaitingSectionContent = true;
    if (!stack.length && units && !awaitingSectionContent && ['resumeSubHeadingListStart', 'resumeItemListStart'].includes(command)) {
      choices.push({ token, kind: command === 'resumeItemListStart' ? 'item-list' : 'entry-list' });
    }
    if (entries.has(command) && stack.length === 1 && stack[0].kind === 'heading' && stack[0].members[0] !== token) choices.push({ token, kind: 'entry' });
    if (items.has(command) && stack.at(-1)?.kind === 'item' && stack.at(-1).members[0] !== token
      && stack.length <= 2 && (stack.length === 1 || stack[0].kind === 'heading')) choices.push({ token, kind: 'item' });
    if (entries.has(command) || items.has(command)) { units++; awaitingSectionContent = false; }
    if (command === 'newpage' || command === 'pagebreak') {
      // Consume the padding attached to the old physical break as one edit.
      const suffix = body.slice(token.end).match(/^(?:\[[0-4]\])?\s*(?:\\vspace\*\{24pt\})?/);
      changes.push({ start: token.index, end: token.end + (suffix?.[0].length || 0), text: '', compact: '' });
    } else if (command === 'vspace') {
      const value = body.slice(token.end).match(/^\{(\d+(?:\.\d+)?)pt\}/);
      if (value) changes.push({ start: token.index, end: token.end + value[0].length, text: body.slice(token.index, token.end + value[0].length), compact: '\\vspace{0pt}' });
    } else if (command === 'resumeItemListStart') changes.push({ start: token.index, end: token.end,
      text: body.slice(token.index, token.end), compact: `\\resumeItemListStart${token.optionsPrefix}[${compactOptions(token.options)}]` });
  }
  // Spread a large catalog over the whole document; never expose candidate text.
  const selected = choices.length <= 128 ? choices : Array.from({ length: 128 }, (_, i) => choices[Math.round(i * (choices.length - 1) / 127)]);
  const candidates = selected.map((choice, id) => ({ ...choice, id }));
  if (pagination.exact && pagination.targetPages === 2 && !candidates.length) return null;
  const measurements = candidates.map(({ id, kind, token }) => `${id}:${kind}:${Math.round(100 * (token.index - headerEnd) / Math.max(1, body.length - headerEnd))}%`).join(', ');
  const prompt = `Repair only the physical pagination of an already validated Abey resume. It currently has ${pageCount} pages; require ${pagination.exact ? 'exactly' : 'at most'} ${pagination.targetPages} pages.\n`
    + 'Return JSON with exactly two keys: spacing ("original" or "compact") and breakBefore (a listed integer ID or null). No LaTeX or candidate text.\n'
    + 'Compact removes excess positive vertical gaps and list spacing without changing words, fonts or margins. '
    + 'All old physical page breaks will be removed. For overflow choose compact. '
    + (pagination.targetPages === 1 ? 'Use null for a one-page document. ' : pagination.exact
      ? 'Choose one natural break near the middle so the existing content occupies both pages. ' : 'Use null to allow natural flow, or select one balanced break. ')
    + `Safe break choices (ID:type:approximate content position): ${measurements || 'none'}.`;
  return { body, changes, candidates, pagination, prompt };
}

export function applyPaginationRepair(plan, response) {
  let choice;
  try { choice = JSON.parse(response); } catch { throw resumeFailure('pagination_repair_invalid'); }
  if (!choice || Array.isArray(choice) || Object.keys(choice).sort().join(',') !== 'breakBefore,spacing'
    || !['original', 'compact'].includes(choice.spacing)
    || !(choice.breakBefore === null || Number.isInteger(choice.breakBefore))) throw resumeFailure('pagination_repair_invalid');
  const candidate = plan.candidates.find(value => value.id === choice.breakBefore);
  if ((choice.breakBefore !== null && !candidate) || (plan.pagination.targetPages === 1 && candidate)
    || (plan.pagination.exact && plan.pagination.targetPages === 2 && !candidate)) throw resumeFailure('pagination_repair_invalid');
  const compact = choice.spacing === 'compact';
  const edits = plan.changes.map(change => ({ ...change, text: compact ? change.compact : change.text }));
  if (candidate) {
    const { token, kind } = candidate;
    let close = '', reopen = '';
    if (kind === 'entry') { close = '\\resumeSubHeadingListEnd\n'; reopen = '\\resumeSubHeadingListStart\n'; }
    if (kind === 'item') {
      const itemList = token.stack.at(-1), headingList = token.stack.length === 2 ? token.stack[0] : null;
      close = '\\resumeItemListEnd\n' + (headingList ? '\\resumeSubHeadingListEnd\n' : '');
      const options = compact ? compactOptions(itemList.options) : itemList.options;
      reopen = `\\resumeItemListStart${options ? `[${options}]` : ''}\n`;
      if (headingList) {
        // Continue bullets at the root. Reopen the heading list only when the
        // next real entry begins, so no empty or repeated heading is invented.
        const next = headingList.members.find(member => member.index > token.index);
        if (next) edits.push({ start: next.index, end: next.index, text: '\\resumeSubHeadingListStart\n' });
        else edits.push({ start: headingList.close.index, end: headingList.close.end, text: '' });
      }
    }
    edits.push({ start: token.index, end: token.index, text: `${close}\\newpage\n\\vspace*{24pt}\n${reopen}` });
  }
  let body = plan.body, boundary = body.length;
  for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) {
    // A break padding edit may subsume the vspace token it consumed.
    if (edit.end > boundary) {
      const enclosing = edits.find(other => other !== edit && other.start <= edit.start && other.end >= edit.end);
      if (enclosing) continue;
      throw resumeFailure('pagination_repair_invalid');
    }
    body = body.slice(0, edit.start) + edit.text + body.slice(edit.end);
    boundary = edit.start;
  }
  return RESUME_LATEX_PREAMBLE + body;
}
