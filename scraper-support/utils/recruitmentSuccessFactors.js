// SAP RMK also publishes role pages with an untyped itemscope shell. Use only
// the native role's active property elements; unrelated scopes cannot donate.
export function recruitmentSuccessFactorsPostings(document, pageURL) {
  const page = new URL(pageURL), match = page.pathname.match(/^\/job\/[^/]+\/([1-9]\d{2,19})\/?$/)
  if (!match) return []
  const shells = document.nodes(node => (node.attrs.class || '').split(/\s+/).includes('jobDisplayShell') && Object.hasOwn(node.attrs, 'itemscope'))
  if (shells.length !== 1 || shells[0].attrs.itemtype) return []
  const scope = shells[0], fields = new Map(), issues = []
  const visit = parent => {
    for (const child of parent.children) {
      if (typeof child === 'string' || child.inert || Object.hasOwn(child.attrs, 'itemscope')) continue
      const key = child.attrs['data-careersite-propertyid']
      if (key && !['script', 'style', 'meta', 'link'].includes(child.tag)) {
        const value = document.text(child).trim()
        if (value) {
          if (!fields.has(key)) fields.set(key, new Set())
          fields.get(key).add(value)
        }
      }
      visit(child)
    }
  }
  visit(scope)
  const scalar = key => {
    const values = [...(fields.get(key) || [])]
    if (values.length > 1) issues.push('ambiguous-native-rmk-' + key)
    return values.length === 1 ? values[0] : null
  }
  const title = scalar('title'), description = scalar('description'), country = scalar('country')
  const employer = scalar('company') || scalar('hiringOrganization')
  return [{ '@type': 'JobPosting', nativeRepresentation: 'successfactors-visible-role-properties',
    nativeMicrodataIssues: issues, nativeVisibleTitleConfirmed: Boolean(title), identifier: { value: match[1] },
    url: page.href, title, description, hiringOrganization: employer ? { name: employer } : null,
    jobLocation: [{ address: { addressCountry: country, addressLocality: scalar('city'), addressRegion: scalar('state') } }],
    datePosted: scalar('date'), employmentType: scalar('shifttype') }]
}
