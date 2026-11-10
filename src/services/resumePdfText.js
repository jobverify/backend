// Some TeX PDFs omit hasEOL even when text is drawn on different lines. Preserve
// visual line boundaries so employers, qualifications, and dates stay grouped.
export function resumePdfText(items = []) {
  let text = '', previous;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    if (!item.str) {
      if (item.hasEOL && text && !text.endsWith('\n')) text += '\n';
      continue;
    }
    const y = item.transform?.[5];
    const previousY = previous?.transform?.[5];
    if (text && !text.endsWith('\n')) {
      if (Number.isFinite(previousY) && Number.isFinite(y) && Math.abs(y - previousY) > 2) text += '\n';
      else if (!/\s$/.test(text) && !/^\s/.test(item.str)) {
        // PDF.js can split one word at a font or drawing-state change. Adding
        // a space to every run corrupts names, emails, dates and skill names.
        const x = item.transform?.[4], previousX = previous?.transform?.[4];
        const gap = x - (previousX + previous?.width);
        const tolerance = Math.max(0.25, Math.abs(previous?.transform?.[0] || 0) * 0.05);
        const adjacent = Number.isFinite(gap) && previous.width > 0 && previous.dir !== 'rtl' && item.dir !== 'rtl'
          && Math.abs(gap) <= tolerance;
        if (!adjacent) text += ' ';
      }
    }
    text += item.str + (item.hasEOL ? '\n' : '');
    previous = item;
  }
  return text.replace(/[ \t]+\n/g, '\n').trim();
}
