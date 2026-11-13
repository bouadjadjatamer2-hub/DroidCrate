import { useMemo, type MouseEvent } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Lessons are Markdown files on disk. They are parsed and sanitised here, so
 * even a hand-edited lesson file cannot inject scripts into the renderer.
 * `dir` lets an Arabic lesson render right-to-left while code stays LTR.
 */
export function Markdown({ source, dir = 'ltr' }: { source: string; dir?: 'ltr' | 'rtl' }) {
  const html = useMemo(() => {
    const raw = marked.parse(source, { async: false, gfm: true, breaks: false })
    return DOMPurify.sanitize(raw as string, { USE_PROFILES: { html: true } })
  }, [source])

  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href) return
    event.preventDefault()
    if (href.startsWith('https://') || href.startsWith('http://')) {
      void window.droidcrate.openExternal(href)
    }
  }

  return (
    <div
      className="markdown"
      dir={dir}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
