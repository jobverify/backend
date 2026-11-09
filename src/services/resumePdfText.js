// Some TeX PDFs omit hasEOL even when text is drawn on different lines. Preserve
// visual line boundaries so employers, qualifications, and dates stay grouped.
export function resumePdfText(items = []) {
  let text = '', previousY;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5];
    if (text && !text.endsWith('\n') && Number.isFinite(previousY) && Number.isFinite(y) && Math.abs(y - previousY) > 2) text += '\n';
    text += item.str + (item.hasEOL ? '\n' : ' ');
    previousY = y;
  }
  return text.replace(/[ \t]+\n/g, '\n').trim();
}
