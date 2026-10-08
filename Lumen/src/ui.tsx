import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { formatCount, formatDuration, formatRelative, isVideoId, safeThumbnail, safeYouTubeUrl } from './format'
import { LANGUAGES, REGIONS, categoryName } from './options'
import type { CategoryOption, Filters, VideoResult } from './types'

type Option<T extends string> = { value: T; label: string }

export function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: T
  options: Option<T>[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className={disabled ? 'field is-disabled' : 'field'}>
      <span className="field-label" id={id}>
        {label}
      </span>
      <div className="seg" data-count={options.length} role="group" aria-labelledby={id}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SelectField({
  label,
  value,
  hint,
  disabled,
  onChange,
  children,
}: {
  label: string
  value: string
  hint?: string
  disabled?: boolean
  onChange: (value: string) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className={disabled ? 'field is-disabled' : 'field'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}

export function FilterPanel({
  filters,
  categories,
  channelDraft,
  open,
  onChannelDraft,
  onCommitChannel,
  onChange,
  onReset,
  onClose,
}: {
  filters: Filters
  categories: CategoryOption[]
  channelDraft: string
  open: boolean
  onChannelDraft: (value: string) => void
  onCommitChannel: () => void
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
  onClose: () => void
}) {
  const locked = filters.eventType !== 'any'
  return (
    <aside id="filters" className={open ? 'filters is-open' : 'filters'} aria-label="Search filters">
      <div className="filter-head">
        <h2>Filters</h2>
        <div className="filter-head-actions">
          <button type="button" className="text-btn" onClick={onReset}>
            Reset
          </button>
          <button type="button" className="text-btn filter-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <section className="group">
        <h3>Sort</h3>
        <Segmented
          label="Order"
          value={filters.order}
          onChange={(order) => onChange({ order })}
          options={[
            { value: 'relevance', label: 'Match' },
            { value: 'date', label: 'New' },
            { value: 'viewCount', label: 'Views' },
            { value: 'rating', label: 'Rating' },
            { value: 'title', label: 'Title' },
          ]}
        />
        <Segmented
          label="Length"
          value={filters.videoDuration}
          disabled={locked}
          onChange={(videoDuration) => onChange({ videoDuration })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'short', label: '<4m' },
            { value: 'medium', label: '4–20m' },
            { value: 'long', label: '>20m' },
          ]}
        />
        <Segmented
          label="Uploaded"
          value={filters.publishedWithin}
          onChange={(publishedWithin) => onChange({ publishedWithin })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'hour', label: 'Hour' },
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
        <Segmented
          label="Per page"
          value={String(filters.maxResults) as '12' | '24' | '36'}
          onChange={(maxResults) => onChange({ maxResults: Number(maxResults) })}
          options={[
            { value: '12', label: '12' },
            { value: '24', label: '24' },
            { value: '36', label: '36' },
          ]}
        />
      </section>

      <section className="group">
        <h3>Picture</h3>
        {locked ? (
          <p className="hint lock-note">
            Broadcast filters can’t be combined with length, quality, captions, license, dimension, category, or
            embeddable. Those controls are paused until broadcast is Any.
          </p>
        ) : null}
        <Segmented
          label="Quality"
          value={filters.videoDefinition}
          disabled={locked}
          onChange={(videoDefinition) => onChange({ videoDefinition })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'high', label: 'HD' },
            { value: 'standard', label: 'SD' },
          ]}
        />
        <Segmented
          label="Dimension"
          value={filters.videoDimension}
          disabled={locked}
          onChange={(videoDimension) => onChange({ videoDimension })}
          options={[
            { value: 'any', label: 'Any' },
            { value: '2d', label: '2D' },
            { value: '3d', label: '3D' },
          ]}
        />
        <Segmented
          label="Captions"
          value={filters.videoCaption}
          disabled={locked}
          onChange={(videoCaption) => onChange({ videoCaption })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'closedCaption', label: 'CC' },
            { value: 'none', label: 'None' },
          ]}
        />
        <label className={locked ? 'check is-disabled' : 'check'}>
          <input
            type="checkbox"
            checked={filters.videoEmbeddable}
            disabled={locked}
            onChange={(event) => onChange({ videoEmbeddable: event.target.checked })}
          />
          <span>Embeddable only</span>
        </label>
      </section>

      <section className="group">
        <h3>Rights</h3>
        <Segmented
          label="License"
          value={filters.videoLicense}
          disabled={locked}
          onChange={(videoLicense) => onChange({ videoLicense })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'creativeCommon', label: 'CC' },
            { value: 'youtube', label: 'Standard' },
          ]}
        />
        <Segmented
          label="Safe search"
          value={filters.safeSearch}
          onChange={(safeSearch) => onChange({ safeSearch })}
          options={[
            { value: 'none', label: 'Off' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'strict', label: 'Strict' },
          ]}
        />
      </section>

      <section className="group">
        <h3>Catalog</h3>
        <SelectField
          label="Category"
          value={filters.videoCategoryId}
          disabled={locked}
          onChange={(videoCategoryId) => onChange({ videoCategoryId })}
        >
          <option value="">Any category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <Segmented
          label="Broadcast"
          value={filters.eventType}
          onChange={(eventType) => onChange({ eventType })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'live', label: 'Live' },
            { value: 'upcoming', label: 'Soon' },
            { value: 'completed', label: 'Replay' },
          ]}
        />
      </section>

      <section className="group">
        <h3>Locale</h3>
        <SelectField
          label="Region bias"
          value={filters.regionCode}
          hint="Biases ranking. It does not exclude other regions."
          onChange={(regionCode) => onChange({ regionCode })}
        >
          {REGIONS.map((region) => (
            <option key={region.code || 'any'} value={region.code}>
              {region.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Language bias"
          value={filters.relevanceLanguage}
          hint="Biases ranking toward this language."
          onChange={(relevanceLanguage) => onChange({ relevanceLanguage })}
        >
          {LANGUAGES.map((language) => (
            <option key={language.code || 'any'} value={language.code}>
              {language.name}
            </option>
          ))}
        </SelectField>
        <div className="field">
          <label className="field-label" htmlFor="channel">
            Channel
          </label>
          <input
            id="channel"
            value={channelDraft}
            spellCheck={false}
            autoCapitalize="off"
            placeholder="Name, @handle, or UC id"
            onChange={(event) => onChannelDraft(event.target.value)}
            onBlur={onCommitChannel}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onCommitChannel()
              }
            }}
          />
        </div>
      </section>
    </aside>
  )
}

function broadcastLabel(video: VideoResult): string | null {
  if (video.liveBroadcastContent === 'live') return 'Live'
  if (video.liveBroadcastContent === 'upcoming') return 'Soon'
  if (video.liveBroadcastContent === 'completed') return 'Replay'
  return null
}

export function VideoCard({
  video,
  selected,
  categories,
  onSelect,
}: {
  video: VideoResult
  selected: boolean
  categories: CategoryOption[]
  onSelect: (video: VideoResult) => void
}) {
  const broadcast = broadcastLabel(video)
  const duration = formatDuration(video.durationSec)
  const category = categoryName(video.categoryId, categories)
  const thumbnail = safeThumbnail(video.id, video.thumbnail)
  return (
    <article>
      <button
        type="button"
        className={selected ? 'card is-selected' : 'card'}
        aria-pressed={selected}
        onClick={() => onSelect(video)}
      >
        <span className="thumb">
          {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : null}
          <span className="badges">
            {broadcast ? <span className={broadcast === 'Live' ? 'badge live' : 'badge'}>{broadcast}</span> : null}
            {video.definition === 'hd' ? <span className="badge">HD</span> : null}
            {video.definition === 'sd' ? <span className="badge">SD</span> : null}
            {video.caption ? <span className="badge">CC</span> : null}
            {video.license === 'creativeCommon' ? <span className="badge cc">CC</span> : null}
          </span>
          {duration ? <span className="dur">{duration}</span> : null}
        </span>
        <span className="card-body">
          <span className="title">{video.title}</span>
          <span className="meta">
            {video.channelTitle || 'Unknown channel'}
            {video.viewCount != null ? ` · ${formatCount(video.viewCount)} views` : ''}
            {video.publishedAt ? ` · ${formatRelative(video.publishedAt)}` : ''}
          </span>
          <span className="meta dim">{category}</span>
        </span>
      </button>
    </article>
  )
}

export function Skeletons() {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="skel" key={index} />
      ))}
    </div>
  )
}

export function PlayerDock({
  video,
  approximate,
  onClose,
}: {
  video: VideoResult
  approximate: boolean
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setExpanded(false)
    setCopied(false)
  }, [video.id])

  const watchUrl = isVideoId(video.id)
    ? `https://www.youtube.com/watch?v=${video.id}`
    : 'https://www.youtube.com'
  const channelUrl = safeYouTubeUrl(video.channelUrl)
  const longDescription = video.description.length > 160

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(watchUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <aside className="dock" aria-label="Player">
      <div className="dock-bar">
        <p className="kicker">Now playing</p>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>
      {video.embeddable && isVideoId(video.id) ? (
        <div className="player-frame">
          <iframe
            key={video.id}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <p className="hint">Embedding is disabled for this video.</p>
      )}
      <h2 className="dock-title">{video.title}</h2>
      <p className="meta">
        <a href={channelUrl} target="_blank" rel="noreferrer">
          {video.channelTitle || 'Channel'}
        </a>
        {video.viewCount != null ? ` · ${formatCount(video.viewCount)} views` : ''}
        {video.likeCount != null ? ` · ${formatCount(video.likeCount)} likes` : ''}
        {video.publishedAt ? ` · ${formatRelative(video.publishedAt)}` : ''}
      </p>
      {approximate ? <p className="hint">Sample stats are approximate. Live search replaces them.</p> : null}
      {video.description ? (
        <>
          <p className={expanded || !longDescription ? 'desc' : 'desc clamped'}>{video.description}</p>
          {longDescription ? (
            <button type="button" className="text-btn" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
        </>
      ) : null}
      <div className="dock-actions">
        <a className="primary linkish" href={watchUrl} target="_blank" rel="noreferrer">
          Watch on YouTube
        </a>
        <button type="button" className="ghost-btn" onClick={() => void copyLink()}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="sr" role="status">
        {copied ? 'Link copied' : ''}
      </p>
    </aside>
  )
}

export function KeyDialog({
  open,
  initial,
  usingEnv,
  onClose,
  onSave,
}: {
  open: boolean
  initial: string
  usingEnv: boolean
  onClose: () => void
  onSave: (key: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(initial)
  const [show, setShow] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (open) {
      setDraft(initial)
      setShow(false)
    }
  }, [open, initial])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === ref.current) ref.current?.close()
      }}
    >
      <form
        className="key-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) return
          onSave(draft.trim())
          ref.current?.close()
        }}
      >
        <p className="kicker">YouTube Data API v3</p>
        <h2 id={titleId}>Connect a key</h2>
        <p className="lede">
          The key stays in this browser. Restrict it to YouTube Data API v3, and for local use allow{' '}
          <span className="mono">http://localhost:5173/*</span>.
        </p>
        {usingEnv ? <p className="hint">A key is already set in the environment. Saving here overrides it.</p> : null}
        <label className="field" htmlFor="api-key">
          <span className="field-label">API key</span>
          <input
            id="api-key"
            value={draft}
            autoComplete="off"
            spellCheck={false}
            type={show ? 'text' : 'password'}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        {draft.trim() && !draft.trim().startsWith('AIza') ? (
          <p className="hint">YouTube keys usually start with AIza.</p>
        ) : null}
        <div className="dock-actions">
          <button type="submit" className="primary" disabled={!draft.trim()}>
            Save key
          </button>
          <button type="button" className="ghost-btn" onClick={() => setShow((value) => !value)}>
            {show ? 'Hide' : 'Show'}
          </button>
          {initial ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                onSave('')
                ref.current?.close()
              }}
            >
              Remove key
            </button>
          ) : null}
        </div>
        <p className="hint">
          <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
            Enable the API in Google Cloud
          </a>
        </p>
      </form>
    </dialog>
  )
}
