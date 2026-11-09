// Read navigation targets while ignoring comments, raw text, iframe fallback
// markup and nested inactive templates. No scripts or browser actions execute.
export const extractOfficialRecruitmentLinks = (html, base) => {
  const links = []
  const inert = []
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'noembed', 'noframes', 'iframe', 'plaintext'])
  const tokens = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let tag
  while (tokens.lastIndex < html.length) {
    if (raw.has(inert.at(-1))) {
      if (inert.at(-1) === 'plaintext') break
      // Raw HTML text ignores quotes and apparent tags inside its contents.
      const close = new RegExp(`</${inert.at(-1)}\\s*>`, 'gi')
      close.lastIndex = tokens.lastIndex
      const end = close.exec(html)
      if (!end) break
      inert.pop(); tokens.lastIndex = close.lastIndex
      continue
    }
    tag = tokens.exec(html)
    if (!tag) break
    if (!tag[1]) continue
    const name = tag[1].toLowerCase(); const closing = tag[0].startsWith('</')
    if (closing) { if (name === 'template' && inert.at(-1) === name) inert.pop(); continue }
    if (inert.length || !['a', 'iframe'].includes(name)) {
      if (name === 'template' || raw.has(name)) inert.push(name)
      continue
    }
    const required = name === 'a' ? 'href' : 'src'
    for (const attr of tag[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g)) {
      if (attr[1].toLowerCase() !== required) continue
      try { links.push(new URL((attr[2] ?? attr[3] ?? attr[4] ?? '').replace(/&amp;/g, '&'), base)) } catch { /* Invalid link. */ }
      break
    }
    if (name === 'iframe') inert.push(name)
  }
  return links
}
