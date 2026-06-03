import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

type LexNode = {
  type: string
  text?: string
  format?: number
  tag?: string
  url?: string
  newTab?: boolean
  listType?: string
  fields?: { url?: string; newTab?: boolean; alt?: string }
  value?: { url?: string; alt?: string; width?: number; height?: number }
  children?: LexNode[]
}

const BOLD = 1
const ITALIC = 2
const STRIKETHROUGH = 4
const UNDERLINE = 8
const CODE = 16

function applyFormat(text: string, format: number): React.ReactNode {
  let el: React.ReactNode = text
  if (format & CODE) el = <code className="lex-code">{el}</code>
  if (format & BOLD) el = <strong>{el}</strong>
  if (format & ITALIC) el = <em>{el}</em>
  if (format & STRIKETHROUGH) el = <s>{el}</s>
  if (format & UNDERLINE) el = <u>{el}</u>
  return el
}

function renderNode(node: LexNode, key: number): React.ReactNode {
  switch (node.type) {
    case 'text': {
      const fmt = node.format ?? 0
      if (!fmt) return node.text ?? null
      return <React.Fragment key={key}>{applyFormat(node.text ?? '', fmt)}</React.Fragment>
    }
    case 'linebreak':
      return <br key={key} />
    case 'paragraph': {
      const children = node.children?.map((c, i) => renderNode(c, i)) ?? []
      const empty = children.every((c) => c === null || c === undefined || c === '')
      if (empty) return <br key={key} />
      return <p key={key}>{children}</p>
    }
    case 'heading': {
      const tag = (node.tag || 'h2') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      const Tag = tag
      return <Tag key={key}>{node.children?.map((c, i) => renderNode(c, i))}</Tag>
    }
    case 'link': {
      const href = node.fields?.url || node.url || '#'
      const isExternal = node.fields?.newTab || node.newTab || href.startsWith('http')
      if (isExternal) {
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {node.children?.map((c, i) => renderNode(c, i))}
          </a>
        )
      }
      return (
        <Link key={key} href={href}>
          {node.children?.map((c, i) => renderNode(c, i))}
        </Link>
      )
    }
    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return <Tag key={key}>{node.children?.map((c, i) => renderNode(c, i))}</Tag>
    }
    case 'listitem':
      return <li key={key}>{node.children?.map((c, i) => renderNode(c, i))}</li>
    case 'quote':
      return <blockquote key={key}>{node.children?.map((c, i) => renderNode(c, i))}</blockquote>
    case 'horizontalrule':
      return <hr key={key} />
    case 'upload': {
      const src = node.value?.url
      const alt = node.value?.alt || ''
      if (!src) return null
      const w = node.value?.width || 800
      const h = node.value?.height || 450
      return (
        <figure key={key} className="lex-figure">
          <Image src={src} alt={alt} width={w} height={h} className="lex-image" />
          {alt && <figcaption className="lex-caption">{alt}</figcaption>}
        </figure>
      )
    }
    default:
      if (node.children) {
        return (
          <React.Fragment key={key}>
            {node.children.map((c, i) => renderNode(c, i))}
          </React.Fragment>
        )
      }
      return null
  }
}

export function RenderLexical({ content }: { content: any }) {
  if (!content || typeof content !== 'object') return null
  const root = content.root ?? content
  if (!Array.isArray(root?.children) || root.children.length === 0) return null
  return (
    <div className="prose-guide">
      {root.children.map((node: LexNode, i: number) => renderNode(node, i))}
    </div>
  )
}
