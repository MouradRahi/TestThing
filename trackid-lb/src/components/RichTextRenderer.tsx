import type { ReactNode } from 'react'

type LexicalNode = {
  type: string
  version?: number
  children?: LexicalNode[]
  text?: string
  format?: number
  tag?: string
  listType?: 'bullet' | 'number'
  url?: string
  fields?: { url?: string; newTab?: boolean }
}

type LexicalContent = {
  root: LexicalNode
}

export function RichTextRenderer({ content }: { content: LexicalContent }) {
  if (!content?.root?.children) return null
  return (
    <div className="rich-text space-y-4 text-sm text-foreground leading-relaxed">
      {serializeChildren(content.root.children)}
    </div>
  )
}

function serializeChildren(nodes: LexicalNode[]): ReactNode[] {
  return nodes.map((node, i) => serialize(node, i)).filter(Boolean)
}

function serialize(node: LexicalNode, key: number): ReactNode {
  switch (node.type) {
    case 'text': {
      if (!node.text) return null
      const fmt = node.format ?? 0
      if (fmt === 0) return node.text

      if (fmt & 16) {
        return (
          <code key={key} className="font-mono text-xs bg-surface border border-border px-1 py-0.5 rounded-sm">
            {node.text}
          </code>
        )
      }
      return (
        <span
          key={key}
          style={{
            fontWeight: fmt & 1 ? 700 : undefined,
            fontStyle: fmt & 2 ? 'italic' : undefined,
            textDecoration: fmt & 8 ? 'underline' : undefined,
          }}
        >
          {node.text}
        </span>
      )
    }

    case 'paragraph': {
      const children = serializeChildren(node.children ?? [])
      if (children.length === 0) return <br key={key} />
      return <p key={key}>{children}</p>
    }

    case 'heading': {
      const children = serializeChildren(node.children ?? [])
      switch (node.tag) {
        case 'h1': return <h1 key={key} className="text-2xl font-bold text-foreground mt-8 mb-3">{children}</h1>
        case 'h2': return <h2 key={key} className="text-xl font-bold text-foreground mt-6 mb-2">{children}</h2>
        case 'h3': return <h3 key={key} className="text-base font-semibold text-foreground mt-4 mb-1">{children}</h3>
        default:   return <h4 key={key} className="text-sm font-semibold text-foreground mt-3">{children}</h4>
      }
    }

    case 'list': {
      const children = serializeChildren(node.children ?? [])
      return node.listType === 'number'
        ? <ol key={key} className="list-decimal list-inside space-y-1 text-muted pl-2">{children}</ol>
        : <ul key={key} className="list-disc list-inside space-y-1 text-muted pl-2">{children}</ul>
    }

    case 'listitem':
      return <li key={key}>{serializeChildren(node.children ?? [])}</li>

    case 'link': {
      const url = node.fields?.url ?? node.url ?? '#'
      const newTab = node.fields?.newTab
      return (
        <a
          key={key}
          href={url}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
          className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
        >
          {serializeChildren(node.children ?? [])}
        </a>
      )
    }

    case 'quote':
      return (
        <blockquote key={key} className="border-l-2 border-accent/50 pl-4 italic text-muted">
          {serializeChildren(node.children ?? [])}
        </blockquote>
      )

    case 'horizontalrule':
      return <hr key={key} className="border-border my-6" />

    default:
      if (node.children) return <span key={key}>{serializeChildren(node.children)}</span>
      return null
  }
}
