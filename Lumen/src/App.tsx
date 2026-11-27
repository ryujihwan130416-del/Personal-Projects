import { useEffect, useRef, useState } from 'react'
import { YouTubeError, fetchCategories, searchYouTube } from './api'
import { searchDemo } from './demo'
import { CATEGORIES, SUGGESTIONS } from './options'
import { DEFAULT_FILTERS, activeChips, hasSearchTarget } from './query'
import { hasStoredApiKey, readApiKey, writeApiKey } from './storage'
import type { CategoryOption, Chip, Filters, SearchPage, VideoResult } from './types'
import { FilterPanel, KeyDialog, PlayerDock, Skeletons, VideoCard } from './ui'
import { formatCount } from './format'

type Job = {
  filters: Filters
  pageToken?: string
  id: number
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(now) + ' UTC'
  )
}

export function App() {
  const [apiKey, setApiKey] = useState(readApiKey)
  const [preferSample, setPreferSample] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [channelDraft, setChannelDraft] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>(CATEGORIES)
  const [job, setJob] = useState<Job | null>(null)
  const [page, setPage] = useState<SearchPage | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<VideoResult | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const streamRef = useRef<HTMLDivElement>(null)
  const clock = useClock()
  const live = Boolean(apiKey) && !preferSample
  const chips = activeChips(job?.filters ?? filters, categories)

  useEffect(() => {
    if (!job) return
    const controller = new AbortController()
    let ignore = false
    setStatus('loading')
    setSearchError(null)

    ;(async () => {
      try {
        const nextPage =
          live && apiKey
            ? await searchYouTube(apiKey, job.filters, job.pageToken, controller.signal)
            : searchDemo(job.filters, job.pageToken, new Date())
        if (ignore) return
        setPage(nextPage)
        setStatus('ready')
      } catch (error) {
        if (ignore || (error instanceof DOMException && error.name === 'AbortError')) return
        setStatus('error')
        setSearchError(error instanceof Error ? error.message : 'Search failed.')
      }
    })()

    return () => {
      ignore = true
      controller.abort()
    }
  }, [job, live, apiKey])

  useEffect(() => {
    streamRef.current?.scrollTo({ top: 0 })
  }, [job?.id])

  useEffect(() => {
    if (!apiKey) {
      setCategories(CATEGORIES)
      return
    }
    const controller = new AbortController()
    fetchCategories(apiKey, filters.regionCode || 'US', controller.signal)
      .then((list) => {
        if (list.length > 0) setCategories(list)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (error instanceof YouTubeError) setCategories(CATEGORIES)
      })
    return () => controller.abort()
  }, [apiKey, filters.regionCode])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        document.getElementById('q')?.focus()
      }
      if (event.key === 'Escape' && !keyOpen) {
        setFiltersOpen(false)
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyOpen])

  useEffect(() => {
    const query = job?.filters.q.trim()
    document.title = query ? `${query} — Lumen` : 'Lumen — YouTube search'
  }, [job?.filters.q])

  function issue(next: Filters, pageToken?: string, options?: { closeFilters?: boolean; preserveDraft?: boolean }) {
    if (!options?.preserveDraft) {
      setFilters(next)
      setChannelDraft(next.channelId)
    }
    setNotice(null)
    setJob((current) => ({
      filters: next,
      pageToken,
      id: (current?.id ?? 0) + 1,
    }))
    if (options?.closeFilters) setFiltersOpen(false)
  }

  function applyPatch(base: Filters, patch: Partial<Filters>, run: boolean) {
    const channelId = Object.prototype.hasOwnProperty.call(patch, 'channelId')
      ? (patch.channelId ?? '')
      : base === filters
        ? channelDraft
        : base.channelId
    const next: Filters = { ...base, ...patch, channelId }
    if (!hasSearchTarget(next)) {
      setFilters(next)
      setChannelDraft(next.channelId)
      if (run) {
        setJob(null)
        setPage(null)
        setStatus('idle')
        setSearchError(null)
        setSelected(null)
        setNotice('Enter a search, a channel, or choose a broadcast.')
      }
      return
    }
    if (run || (patch.eventType && patch.eventType !== 'any' && !job)) {
      issue(next)
      return
    }
    setFilters(next)
    setChannelDraft(next.channelId)
  }

  function commit(patch: Partial<Filters>, run = Boolean(job)) {
    applyPatch(filters, patch, run)
  }

  function retarget(sample: boolean) {
    if (sample) {
      if (!apiKey || preferSample) return
      setPreferSample(true)
    } else if (!apiKey) {
      setKeyOpen(true)
      return
    } else if (!preferSample) {
      return
    } else {
      setPreferSample(false)
    }
    setJob((current) =>
      current ? { filters: current.filters, pageToken: undefined, id: current.id + 1 } : current,
    )
  }

  function saveKey(key: string) {
    writeApiKey(key)
    setApiKey(readApiKey() || key.trim())
    setPreferSample(false)
    setJob((current) =>
      current ? { filters: current.filters, pageToken: undefined, id: current.id + 1 } : current,
    )
  }

  const applied = job?.filters
  const resultLabel = page
    ? `${live ? '' : 'Sample · '}${formatCount(page.totalResults)} video${page.totalResults === 1 ? '' : 's'}`
    : ''

  return (
    <div className="app">
      <a className="skip" href="#results">
        Skip to results
      </a>
      <header>
        <div className="brand-lockup">
          <span className="mark" aria-hidden="true" />
          <div>
            <h1>Lumen</h1>
            <p>YouTube search</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters{chips.length > 0 ? ` ${chips.length}` : ''}
          </button>
          <p className="clock">{clock}</p>
          <div className="mode" role="group" aria-label="Data source">
            <button type="button" data-mode="sample" aria-pressed={!live} onClick={() => retarget(true)}>
              Sample
            </button>
            <button type="button" data-mode="live" aria-pressed={live} onClick={() => retarget(false)}>
              Live
            </button>
          </div>
          <button type="button" className="key-btn" onClick={() => setKeyOpen(true)}>
            <span className={apiKey ? 'dot on' : 'dot'} aria-hidden="true" />
            {apiKey ? 'Key linked' : 'Add API key'}
          </button>
        </div>
      </header>

      <div className="shell">
        {filtersOpen ? (
          <button type="button" className="backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />
        ) : null}
        <FilterPanel
          filters={filters}
          categories={categories}
          channelDraft={channelDraft}
          open={filtersOpen}
          onChannelDraft={setChannelDraft}
          onCommitChannel={() => {
            if (channelDraft === filters.channelId) return
            commit({}, Boolean(job) || channelDraft.trim().length > 0)
          }}
          onChange={(patch) => commit(patch, Boolean(job))}
          onReset={() => commit({ ...DEFAULT_FILTERS, q: filters.q }, Boolean(job))}
          onClose={() => setFiltersOpen(false)}
        />

        <div className={selected ? 'workspace has-player' : 'workspace'}>
          <div className="stream" ref={streamRef} id="results">
            {status === 'loading' ? <div className="progress" aria-hidden="true" /> : null}
            {status === 'idle' ? (
              <section className="hero">
                <div className="lens" aria-hidden="true" />
                <p className="kicker">YouTube Data API</p>
                <h2>
                  Search YouTube
                  <br />
                  with every filter in reach.
                </h2>
                <p className="lede">
                  Length, upload date, picture quality, captions, license, category, language, and live broadcasts.
                </p>
              </section>
            ) : null}
            <form
              className="search-form"
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                const next = { ...filters, channelId: channelDraft }
                if (!hasSearchTarget(next)) {
                  setFilters(next)
                  setChannelDraft(next.channelId)
                  setJob(null)
                  setPage(null)
                  setStatus('idle')
                  setSearchError(null)
                  setSelected(null)
                  setNotice('Enter a search, a channel, or choose a broadcast.')
                  return
                }
                issue(next, undefined, { closeFilters: true })
              }}
            >
              <div className="search">
                <label htmlFor="q">Search</label>
                <input
                  id="q"
                  value={filters.q}
                  placeholder="Videos, topics, channels"
                  onChange={(event) => {
                    setFilters({ ...filters, q: event.target.value })
                    setNotice(null)
                  }}
                />
                <kbd>/</kbd>
                {filters.q ? (
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => commit({ q: '' }, Boolean(job))}
                  >
                    Clear
                  </button>
                ) : null}
                <button type="submit" className="primary" disabled={status === 'loading'}>
                  {status === 'loading' ? 'Searching' : 'Search'}
                </button>
              </div>
            </form>

            <div className="suggest" aria-label="Suggested searches">
              {SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => issue({ ...filters, q: term, channelId: channelDraft }, undefined, { closeFilters: true })}
                >
                  {term}
                </button>
              ))}
            </div>

            {notice ? (
              <p className="notice" role="status">
                {notice}
              </p>
            ) : null}

            {!live ? (
              <div className="banner">
                <p>
                  Sample catalog of public videos. Durations and stats are approximate. Add a YouTube Data API key to
                  search the live index.
                </p>
                <button type="button" className="text-btn" onClick={() => setKeyOpen(true)}>
                  Add key
                </button>
              </div>
            ) : (
              <p className="hint quota">Each live search uses about 100 YouTube quota units.</p>
            )}

            {searchError ? (
              <div className="error" role="alert">
                <p>{searchError}</p>
                <div className="dock-actions">
                  <button type="button" className="ghost-btn" onClick={() => setKeyOpen(true)}>
                    Check key
                  </button>
                  {live ? (
                    <button type="button" className="ghost-btn" onClick={() => retarget(true)}>
                      Use sample catalog
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {applied && page ? (
              <Results
                title={applied.q.trim() ? `“${applied.q.trim()}”` : 'Filtered videos'}
                label={resultLabel}
                chips={chips}
                page={page}
                loading={status === 'loading'}
                sample={!live}
                categories={categories}
                selectedId={selected?.id ?? null}
                onChip={(chip: Chip) => applyPatch(applied, chip.patch, true)}
                onSelect={(video) => setSelected((current) => (current?.id === video.id ? null : video))}
                onPrev={
                  page.prevPageToken
                    ? () => issue(applied, page.prevPageToken, { preserveDraft: true })
                    : undefined
                }
                onNext={
                  page.nextPageToken
                    ? () => issue(applied, page.nextPageToken, { preserveDraft: true })
                    : undefined
                }
              />
            ) : null}

            {!page && status === 'loading' ? <Skeletons /> : null}
          </div>

          {selected ? (
            <>
              <button type="button" className="dock-backdrop" aria-label="Close player" onClick={() => setSelected(null)} />
              <PlayerDock video={selected} approximate={!live} onClose={() => setSelected(null)} />
            </>
          ) : null}
        </div>
      </div>

      <KeyDialog
        open={keyOpen}
        initial={apiKey}
        usingEnv={!hasStoredApiKey() && Boolean(apiKey)}
        onClose={() => setKeyOpen(false)}
        onSave={saveKey}
      />
    </div>
  )
}

function Results({
  title,
  label,
  chips,
  page,
  loading,
  sample,
  categories,
  selectedId,
  onChip,
  onSelect,
  onPrev,
  onNext,
}: {
  title: string
  label: string
  chips: Chip[]
  page: SearchPage
  loading: boolean
  sample: boolean
  categories: CategoryOption[]
  selectedId: string | null
  onChip: (chip: Chip) => void
  onSelect: (video: VideoResult) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <section className="results" aria-busy={loading}>
      <div className="result-head">
        <div>
          <h2 className="result-title">{title}</h2>
          <p className="meta" role="status">
            {loading ? 'Searching…' : label}
          </p>
        </div>
        <Pager onPrev={onPrev} onNext={onNext} />
      </div>
      {chips.length > 0 ? (
        <div className="chips" aria-label="Active filters">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className="chip" onClick={() => onChip(chip)}>
              {chip.label}
              <span aria-hidden="true">×</span>
              <span className="sr">Remove {chip.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {page.results.length === 0 && !loading ? (
        <div className="empty">
          <div className="lens" aria-hidden="true" />
          <h3>No videos in this slice</h3>
          <p>
            {sample
              ? 'Widen a filter, or search the live index with an API key.'
              : 'Widen a filter or try another query.'}
          </p>
        </div>
      ) : (
        <div className={loading ? 'grid is-loading' : 'grid'}>
          {page.results.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              categories={categories}
              selected={video.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      {page.results.length > 0 ? (
        <div className="pager-foot">
          <Pager onPrev={onPrev} onNext={onNext} />
        </div>
      ) : null}
    </section>
  )
}

function Pager({ onPrev, onNext }: { onPrev?: () => void; onNext?: () => void }) {
  if (!onPrev && !onNext) return null
  return (
    <div className="pager">
      <button type="button" className="ghost-btn" disabled={!onPrev} onClick={onPrev}>
        Previous
      </button>
      <button type="button" className="ghost-btn" disabled={!onNext} onClick={onNext}>
        Next
      </button>
    </div>
  )
}
