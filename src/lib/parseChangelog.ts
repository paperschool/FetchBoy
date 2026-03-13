import type { ChangelogEntry } from '@/components/ui/WhatsNewModal'

/**
 * Parses the project CHANGELOG.md (Keep a Changelog format) into structured entries.
 * Each `## [x.y.z] - YYYY-MM-DD` block becomes one ChangelogEntry whose `changes`
 * are all bullet lines (starting with `- `) found beneath it.
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []

  const versionRegex = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/

  let current: ChangelogEntry | null = null

  for (const line of markdown.split('\n')) {
    const versionMatch = line.match(versionRegex)
    if (versionMatch) {
      if (current) entries.push(current)
      current = { version: versionMatch[1], date: versionMatch[2], changes: [] }
      continue
    }

    if (current && line.startsWith('- ')) {
      current.changes.push(line.slice(2).trim())
    }
  }

  if (current) entries.push(current)

  return entries
}
