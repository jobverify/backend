// Recover whitespace boundaries only; never invent sections, duties, or facts.
import { recoverDescriptionHeadings, descriptionInlineSpans as inlineSpans } from './jobDescriptionStructure.js';
const labels = String.raw`(?:(?:job|role|position) (?:overview|description|summary)|overview|about (?:us|you|the (?:role|team|company)|this role)|(?:key|main|core|your) responsibilities|responsibilities|your role and responsibilities|what you(?:'|\u2019)ll (?:do|be doing)|what (?:we need to see|you bring|we offer)|(?:required|minimum|basic|preferred|technical) (?:qualifications(?: and skills)?|requirements|skills)|qualifications(?:\s*&\s*required skills)?|requirements|skills|experience(?: you will bring)?|education|eligibility|benefits|employment details|working arrangements?|work arrangement|application (?:details|steps)|good to have|nice to have|ways to stand out from the crowd)`;
const inlineLabel = new RegExp('(^|[.!?][ \\t]+)(' + labels + ')[ \\t]*:[ \\t]*(?=\\S)', 'gi');
const wholeLabel = new RegExp('^' + labels + '[ \\t]*:?[ \\t]*$', 'i');
const listLine = /^\s*(?:[-*+\u2022\u25cf\u25aa\u00b7]\s|\d+[.)]\s)/;
// Protect inline Markdown spans instead of freezing an entire paragraph for a
// literal metadata bracket, underscore, approximate quantity, or single pipe.

export function recoverDescriptionLayout(value) {
  const source = String(value ?? '');
  let fence = null, paragraphBreaks = 0, headingBreaks = 0, listBreaks = 0;
  const lines = source.split('\n');
  const tableRows = new Set();
  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[index])) continue;
    let start = index, end = index;
    while (start > 0 && lines[start - 1].trim()) start--;
    while (end + 1 < lines.length && lines[end + 1].trim()) end++;
    for (let row = start; row <= end; row++) tableRows.add(row);
  }
  const records = lines.map((line, index) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length
        && /^[ \t]*$/.test(line.slice(marker[0].length))) fence = null;
      return { text: line, protected: true };
    }
    if (fence || tableRows.has(index) || /^[ \t]|^>/.test(line) || /^\|.*\|\s*$/.test(line)) return { text: line, protected: true };
    const headingLine = recoverDescriptionHeadings(line);
    const spans = inlineSpans(headingLine);
    const protectedAt = offset => spans.some(([start, end]) => offset >= start && offset < end);
    const structured = headingLine.replace(inlineLabel, (match, before, label, offset) => {
      if (protectedAt(offset + before.length)) return match;
      headingBreaks++;
      return (before ? before.trimEnd() + '\n\n' : '') + label + ':\n\n';
    });
    const listSpans = inlineSpans(structured);
    const protectedList = offset => listSpans.some(([start, end]) => offset >= start && offset < end);
    const hyphens = [...structured.matchAll(/[ \t]+-[ \t]+(?=\p{Lu}[\p{L}]{2,}\b)/gu)].filter(match => !protectedList(match.index));
    const lists = structured.replace(/(\S)[ \t]+(?=[\u2022\u25cf\u25aa\u25c6\uf0b7\uf0a7][ \t]+\S)/g, (match, before, offset) => {
      if (protectedList(offset)) return match;
      listBreaks++;
      return before + '\n';
    });
    const hyphenSpans = inlineSpans(lists);
    const formattedLists = lists.replace(/(\S)[ \t]+-[ \t]+(?=\p{Lu}[\p{L}]{2,}\b)/gu, (match, before, offset) => {
      if (hyphens.length < 2 || hyphenSpans.some(([start, end]) => offset >= start && offset < end)) return match;
      listBreaks++;
      return before + '\n- ';
    });
    const formatted = formattedLists.split('\n').map(part => {
      if (part.length <= 600 || /^\s*#{1,6}\s/.test(part) || listLine.test(part)) return part;
      const protectedSpans = inlineSpans(part);
      let sentences = 0, start = 0;
      return part.replace(/([.!?])([ \t]+)(?=\p{Lu})/gu, (match, punctuation, _space, offset) => {
        if (protectedSpans.some(([begin, end]) => offset >= begin && offset < end)) return match;
        sentences++;
        if (sentences < 3 && offset + 1 - start < 420) return match;
        start = offset + match.length;
        sentences = 0;
        paragraphBreaks++;
        return punctuation + '\n\n';
      });
    }).join('\n');
    return { text: formatted, protected: false };
  });
  for (let index = 1; index < records.length; index++) {
    const previous = records[index - 1], current = records[index];
    if (previous.protected || current.protected || !previous.text.trim() || !current.text.trim()
      || previous.text.endsWith('\n') || current.text.startsWith('\n')
      || listLine.test(previous.text.split('\n').at(-1)) || listLine.test(current.text)) continue;
    if (/[.!?][)\]"'\u2019]*$/.test(previous.text.trimEnd())) {
      previous.text += '\n';
      paragraphBreaks++;
    }
  }
  const text = records.map(record => record.text).join('\n');
  const structured = text.split('\n').some(line => wholeLabel.test(line.trim()) || /^\s*(?:#{1,6}\s|[-*\u2022\u25cf\u25aa]\s|\d+[.)]\s)/.test(line));
  return { text, paragraphBreaks, headingBreaks, listBreaks, structured, changed: text !== source };
}
