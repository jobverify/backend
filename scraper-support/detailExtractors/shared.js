const normalizeWhitespace = (value) =>
  String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(?:br|p|li|div|section|article|h1|h2|h3|h4|h5|h6|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const uniq = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]

export const toPlainText = (html) => normalizeWhitespace(html)

export const firstMatch = (html, patterns) => {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return toPlainText(match[1])
  }
  return null
}

export const collectListItems = (html, headingPatterns) => {
  for (const headingPattern of headingPatterns) {
    const match = html.match(headingPattern)
    if (!match?.[1]) continue

    const items = [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => toPlainText(item[1]))
    const uniqueItems = uniq(items)
    if (uniqueItems.length > 0) {
      return uniqueItems
    }
  }

  return []
}

export const joinItems = (items) => items.length > 0 ? items.join('; ') : null

export const collectSkills = (items = []) =>
  uniq(
    items.flatMap((item) =>
      item.split(/,|\/|\band\b/gi).map((part) => part.trim()),
    ),
  ).filter((item) => item.length >= 2 && item.length <= 40)
