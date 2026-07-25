/** Walks a Lexical body (our simplified shape) and counts internal vs external links. */
export function countLinks(body: any): { internal: number; external: number } {
  let internal = 0
  let external = 0

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'link') {
      const url: string = node.fields?.url || node.url || ''
      const isExternal = /^https?:\/\//i.test(url) && !/injector\.world/i.test(url)
      if (isExternal) external++
      else internal++
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }

  walk(body?.root)
  return { internal, external }
}
