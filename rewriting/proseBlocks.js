import { proseHeadings } from './proseValidation.js';
export { proseHeadings } from './proseValidation.js';

const metadata = /(?<!\S)(Position|Location|Time Type|Job Category|Employment type|Salary)[ \t]*:[ \t]*/gi;
const maxBlockCharacters = 900;

const boundedSpans = (source, offset, sectionContext) => {
  const result = [];
  while (source.length > maxBlockCharacters) {
    const prefix = source.slice(0, maxBlockCharacters);
    let point = 0;
    for (const pattern of [/\n+/g, /[.!?](?:[ \t]+|(?=[\p{Lu}]))/gu, /\s+/g]) {
      for (const match of prefix.matchAll(pattern)) {
        const end = match.index + match[0].length;
        if (end >= maxBlockCharacters / 4) point = end;
      }
      if (point) break;
    }
    // Extremely long identifiers still have to fit, without breaking Unicode.
    if (!point) point = Array.from(prefix).slice(0, -1).join('').length || prefix.length;
    result.push({ source: source.slice(0, point), sourceOffset: offset, sectionContext });
    source = source.slice(point);
    offset += point;
  }
  if (source) result.push({ source, sourceOffset: offset, sectionContext });
  return result;
};

export const buildProseBlocks = source => {
  const fields = [...source.matchAll(metadata)].map(match => ({ start: match.index,
    end: match.index + match[0].length, kind: 'metadata' }));
  // Small sources already have ample output space. Avoid extra generation
  // round trips unless a protected field must be removed from the prompt.
  if (source.length <= maxBlockCharacters && !fields.length) {
    return [{ source, sourceOffset: 0, sectionContext: null }];
  }
  const markers = [...proseHeadings(source), ...fields].sort((a, b) => a.start - b.start);
  const spans = [];
  let offset = 0, sectionContext = null;
  const append = (end, protectedKind) => {
    if (end <= offset) return;
    const text = source.slice(offset, end);
    if (!text.trim() && spans.length) spans.at(-1).source += text;
    else spans.push({ source: text, sourceOffset: offset, sectionContext, ...(protectedKind && { protected: protectedKind }) });
    offset = end;
  };
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    if (marker.start < offset) continue;
    append(marker.start);
    if (marker.kind === 'heading') {
      sectionContext = marker.title;
      append(marker.end, 'heading');
    } else {
      const newline = source.indexOf('\n', marker.end);
      append(Math.min(markers[index + 1]?.start ?? source.length, newline < 0 ? source.length : newline + 1), 'metadata');
    }
  }
  append(source.length);
  return spans.flatMap(span => {
    if (span.protected) return [span];
    // Facts constrain validation, not eligibility. Freezing a whole span for a
    // number or "if" also freezes unrelated prose and can bypass inference.
    return boundedSpans(span.source, span.sourceOffset, span.sectionContext);
  });
};
