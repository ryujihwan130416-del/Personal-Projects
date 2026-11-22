/**
 * Client-side content filter (no Cloud Functions). Runs on every sent or edited text
 * message and in the admin "Scan existing messages" tool. Word lists are editable by
 * the admin and stored at dmly/app/config/moderation.
 */
export type FlagCategory = 'profanity' | 'slur' | 'sexual' | 'threat' | 'selfharm' | 'spam' | 'caps' | 'repetition' | 'mild'

export const CATEGORY_LABEL: Record<FlagCategory, string> = {
  profanity: 'Profanity',
  slur: 'Slurs / hate',
  sexual: 'Sexual content',
  threat: 'Threats / violence',
  selfharm: 'Self-harm',
  spam: 'Spam / scam',
  caps: 'Excessive caps',
  repetition: 'Repetition / flooding',
  mild: 'Mild words',
}
export const LIST_CATEGORIES = ['profanity', 'slur', 'sexual', 'threat', 'selfharm', 'spam', 'mild'] as const
export type ListCategory = (typeof LIST_CATEGORIES)[number]

export interface ModerationConfig {
  lists: Record<ListCategory, string[]>
  allow: string[]
  caps: boolean
  repetition: boolean
  links: boolean
  /** Per-category action for everyone (admin). Flags are recorded either way. */
  modes: Record<FlagCategory, CategoryMode>
  /** Lowest chat-filter level users may pick. */
  minLevel: FilterLevel
  /** Starting chat-filter settings for people who never changed theirs. */
  userDefaults: UserFilter
  updatedAt?: unknown
}

export type CategoryMode = 'log' | 'mask' | 'block'
export type FilterLevel = 'off' | 'low' | 'medium' | 'strict'
export const FILTER_LEVELS: FilterLevel[] = ['off', 'low', 'medium', 'strict']
/** Categories a user's chat filter can hide (self-harm is never hidden, so friends can still help). */
export const USER_CATEGORIES: FlagCategory[] = ['slur', 'threat', 'profanity', 'sexual', 'mild', 'caps', 'spam', 'repetition']
export const LEVEL_CATS: Record<FilterLevel, FlagCategory[]> = {
  off: [],
  low: ['slur', 'threat'],
  medium: ['slur', 'threat', 'profanity', 'sexual'],
  strict: ['slur', 'threat', 'profanity', 'sexual', 'mild', 'caps', 'spam', 'repetition'],
}
export interface UserFilter {
  level: FilterLevel
  /** Turn individual categories of the chosen level off (false) — never below the admin minimum. */
  cats?: Partial<Record<FlagCategory, boolean>>
  /** Replace matched words with *** */
  mask: boolean
  /** Blur whole flagged messages, tap to reveal. */
  blur: boolean
}
export const DEFAULT_USER_FILTER: UserFilter = { level: 'medium', cats: {}, mask: true, blur: false }
export const levelRank = (l: FilterLevel) => FILTER_LEVELS.indexOf(l)
export const ALL_CATEGORIES: FlagCategory[] = ['slur', 'threat', 'selfharm', 'profanity', 'sexual', 'mild', 'spam', 'caps', 'repetition']
export const DEFAULT_MODES: Record<FlagCategory, CategoryMode> = {
  slur: 'log', threat: 'log', selfharm: 'log', profanity: 'log', sexual: 'log', mild: 'log', spam: 'log', caps: 'log', repetition: 'log',
}

/* Defaults. Short English terms (<= 4 letters) match whole words only, to avoid "class"/"assess"
   style false positives; longer terms and all Korean terms also match inside squashed text, which
   catches spacing tricks like "f u c k" or "시 발". */
export const DEFAULT_MODERATION: ModerationConfig = {
  lists: {
    profanity: [
      'fuck', 'fucking', 'fucker', 'motherfucker', 'fck', 'fuk', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'dickhead',
      'cunt', 'wanker', 'prick', 'stfu', 'wtf', 'piss off',
      '씨발', '시발', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '씨빨', '병신', 'ㅂㅅ', '븅신', '개새끼', '개새기', '개색끼', '좆', '존나', 'ㅈㄴ',
      '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '미친놈', '미친년', '염병', '엿먹어',
    ],
    slur: [
      'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'chink', 'spic', 'kike', 'gook', 'wetback',
      '짱깨', '쪽발이', '흑형', '똥남아', '한남충', '김치녀', '맘충', '틀딱', '급식충', '장애인새끼', '애자', '게이새끼', '호모새끼',
    ],
    sexual: [
      'porn', 'porno', 'nudes', 'send nudes', 'blowjob', 'handjob', 'dick pic', 'horny', 'sexting', 'onlyfans', 'cum', 'pussy', 'boobs', 'tits',
      '야동', '섹스', '쎅스', '자위', '보지', '자지', '꼴린다', '꼴려', '야한사진', '몸사진', '알몸', '조건만남', '성매매',
    ],
    threat: [
      'kill you', 'i will kill', 'gonna kill', 'i\'ll kill', 'shoot you', 'stab you', 'beat you up', 'i know where you live', 'you will die', 'hurt you',
      '죽여버', '죽인다', '죽일거', '죽일꺼', '찔러버', '패버린', '때려죽', '가만안둬', '가만 안 둬', '테러',
    ],
    selfharm: [
      'kill myself', 'suicide', 'want to die', 'end my life', 'cut myself', 'self harm', 'self-harm', 'kms',
      '자살', '죽고싶', '죽고 싶', '살기싫', '살기 싫', '목매', '자해', '뛰어내리',
    ],
    mild: [
      'damn', 'dammit', 'crap', 'crappy', 'hell', 'sucks', 'suck it', 'idiot', 'stupid', 'dumb', 'moron', 'loser', 'shut up', 'screw you', 'freaking', 'frickin', 'bloody', 'jerk',
      '바보', '멍청이', '멍청', '짜증나', '닥치', '찌질', '한심', '또라이', '돌아이',
    ],
    spam: [
      'bit.ly', 'tinyurl', 't.me/', 'free money', 'crypto giveaway', 'double your', 'click here', 'claim your prize', 'you have won', 'gift card', 'investment opportunity', 'dm me for',
      'whatsapp me', '무료충전', '카톡추가', '텔레그램', '수익보장', '고수익', '리딩방', '코인방', '도박', '카지노',
    ],
  },
  allow: ['class', 'assess', 'scunthorpe', 'cocktail', 'shiitake'],
  caps: true,
  repetition: true,
  links: true,
  modes: DEFAULT_MODES,
  minLevel: 'off',
  userDefaults: DEFAULT_USER_FILTER,
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '¡': 'i', '€': 'e' }
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/

function deLeet(s: string) {
  return s.replace(/[0-9!|@$+¡€]/g, (c) => LEET[c] ?? c)
}
/** Lowercase, NFKC, l33t → letters, collapse 3+ repeated letters to 2 ("fuuuuck" → "fuuck"). */
function base(s: string) {
  return deLeet(s.normalize('NFKC').toLowerCase()).replace(/(.)\1{2,}/gu, '$1$1')
}
/** Words, with runs of single characters joined ("f u c k" → "fuck"). */
function words(s: string): string[] {
  const raw = s.split(/[^\p{L}\p{N}']+/u).filter(Boolean)
  const out: string[] = []
  let run = ''
  for (const w of raw) {
    if ([...w].length === 1) { run += w; continue }
    if (run) { out.push(run); run = '' }
    out.push(w)
  }
  if (run) out.push(run)
  return out
}
const squash = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '')
const dedupe = (s: string) => s.replace(/(.)\1+/gu, '$1')

export interface Detection {
  categories: FlagCategory[]
  terms: string[]
  category: FlagCategory
}

export function detect(text: string, cfg: ModerationConfig = DEFAULT_MODERATION): Detection | null {
  const src = (text ?? '').trim()
  if (!src) return null
  let b = base(src)
  for (const a of cfg.allow ?? []) if (a.trim()) b = b.split(a.trim().toLowerCase()).join(' ')
  const ws = words(b)
  const wsDedupe = ws.map(dedupe)
  const sq = squash(b)
  const sqDedupe = dedupe(sq)
  const sqHangul = sq.replace(/[^\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/g, '')
  const hits = new Map<FlagCategory, Set<string>>()
  const hit = (c: FlagCategory, term: string) => { if (!hits.has(c)) hits.set(c, new Set()); hits.get(c)!.add(term) }

  for (const cat of LIST_CATEGORIES) {
    for (const rawTerm of cfg.lists?.[cat] ?? []) {
      const term = rawTerm.trim().toLowerCase()
      if (!term) continue
      if (cat === 'spam' && /[./]/.test(term)) { if (b.includes(term)) hit(cat, term); continue }
      const t = squash(base(term))
      if (!t) continue
      const korean = HANGUL.test(t)
      if (korean) {
        const th = t.replace(/[^\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/g, '')
        if (sq.includes(t) || (th && sqHangul.includes(th)) || dedupe(sqHangul).includes(dedupe(th))) hit(cat, rawTerm.trim())
      } else if (t.length >= 5) {
        if (sq.includes(t) || sqDedupe.includes(dedupe(t))) hit(cat, rawTerm.trim())
      } else if (term.includes(' ')) {
        if (` ${ws.join(' ')} `.includes(` ${term} `)) hit(cat, rawTerm.trim())
      } else {
        // whole word, allowing simple suffixes (fuck → fucks/fucked)
        const td = dedupe(t)
        if (ws.some((w, i) => w === t || wsDedupe[i] === td || (w.startsWith(t) && /^(s|es|ed|er|ers|ing|in)$/.test(w.slice(t.length))))) hit(cat, rawTerm.trim())
      }
    }
  }
  if (cfg.links !== false) {
    const urls = src.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) ?? []
    if (urls.length >= 3) hit('spam', `${urls.length} links`)
    if (urls.some((u) => /\.(xyz|top|click|loan|work|zip|mov|ru|tk|ml|ga|cf|gq)(\/|$)/i.test(u))) hit('spam', 'suspicious link')
  }
  if (cfg.caps !== false) {
    const letters = src.replace(/[^A-Za-z]/g, '')
    if (letters.length >= 12 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.8) hit('caps', 'ALL CAPS')
  }
  if (cfg.repetition !== false) {
    if (/(.)\1{9,}/u.test(src.replace(/\s/g, ''))) hit('repetition', 'repeated characters')
    const counts = new Map<string, number>()
    for (const w of ws) if (w.length >= 2) counts.set(w, (counts.get(w) ?? 0) + 1)
    for (const [w, n] of counts) if (n >= 6 && n / ws.length > 0.5) { hit('repetition', `"${w}" ×${n}`); break }
  }
  if (!hits.size) return null
  const order: FlagCategory[] = ['threat', 'selfharm', 'slur', 'sexual', 'profanity', 'spam', 'repetition', 'caps', 'mild']
  const categories = order.filter((c) => hits.has(c))
  const terms = [...new Set(categories.flatMap((c) => [...hits.get(c)!]))].slice(0, 12)
  return { categories, terms, category: categories[0] }
}

export function normalizeConfig(data: Partial<ModerationConfig> | undefined | null): ModerationConfig {
  const d = DEFAULT_MODERATION
  if (!data) return d
  const lists = { ...d.lists }
  for (const c of LIST_CATEGORIES) if (Array.isArray(data.lists?.[c])) lists[c] = data.lists![c].filter((x) => typeof x === 'string')
  return {
    lists,
    allow: Array.isArray(data.allow) ? data.allow : d.allow,
    caps: data.caps ?? d.caps,
    repetition: data.repetition ?? d.repetition,
    links: data.links ?? d.links,
    modes: { ...DEFAULT_MODES, ...Object.fromEntries(Object.entries(data.modes ?? {}).filter(([k, v]) => k in DEFAULT_MODES && ['log', 'mask', 'block'].includes(v as string))) } as Record<FlagCategory, CategoryMode>,
    minLevel: FILTER_LEVELS.includes(data.minLevel as FilterLevel) ? (data.minLevel as FilterLevel) : 'off',
    userDefaults: cleanUserFilter(data.userDefaults, DEFAULT_USER_FILTER),
  }
}

export function cleanUserFilter(raw: unknown, fallback: UserFilter): UserFilter {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserFilter>
  const cats: Partial<Record<FlagCategory, boolean>> = {}
  for (const [k, v] of Object.entries(r.cats ?? {})) if (ALL_CATEGORIES.includes(k as FlagCategory) && typeof v === 'boolean') cats[k as FlagCategory] = v
  return {
    level: FILTER_LEVELS.includes(r.level as FilterLevel) ? (r.level as FilterLevel) : fallback.level,
    cats,
    mask: typeof r.mask === 'boolean' ? r.mask : fallback.mask,
    blur: typeof r.blur === 'boolean' ? r.blur : fallback.blur,
  }
}

/** Which categories are hidden for this viewer: their level/toggles, never below the admin minimum, plus admin "mask for everyone". */
export function activeCategories(user: UserFilter, cfg: ModerationConfig): Set<FlagCategory> {
  const minCats = new Set(LEVEL_CATS[cfg.minLevel])
  const level = levelRank(user.level) < levelRank(cfg.minLevel) ? cfg.minLevel : user.level
  const out = new Set<FlagCategory>()
  for (const c of LEVEL_CATS[level]) if (user.cats?.[c] !== false || minCats.has(c)) out.add(c)
  for (const c of ALL_CATEGORIES) if (cfg.modes[c] === 'mask') out.add(c)
  return out
}

const LEET_CLASS: Record<string, string> = { a: 'a4@', e: 'e3€', i: 'i1!|¡', o: 'o0', s: 's5$', t: 't7+', b: 'b8', g: 'g9', l: 'l1|' }
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
/** A forgiving regex for one term: case-insensitive, l33t, repeated letters, and junk between letters ("f.u-c k"). */
function termRegex(term: string): RegExp | null {
  const chars = [...term.toLowerCase().replace(/\s+/g, ' ')]
  if (!chars.length) return null
  const parts = chars.map((c) => {
    if (c === ' ') return '[\\s\\W_]*'
    const cls = LEET_CLASS[c] ? `[${[...LEET_CLASS[c]].map(esc).join('')}]` : c === '-' ? '-' : esc(c)
    return `${cls}+`
  })
  const body = parts.join('[\\s.\\-_*~]*')
  const ascii = /^[a-z0-9 .\/'-]+$/i.test(term)
  // short English words only as whole words, like detect()
  const src = ascii && term.replace(/\W/g, '').length <= 4 ? `(?<![\\p{L}\\p{N}])${body}(?:s|es|ed|er|ers|ing|in)?(?![\\p{L}\\p{N}])` : body
  try { return new RegExp(src, 'giu') } catch { return null }
}
const reCache = new Map<string, RegExp | null>()

/**
 * Masks matched words with *** for the given categories. Returns the new text and the categories
 * that actually matched (so callers can blur the whole message instead).
 */
export function filterText(text: string, cats: Set<FlagCategory>, cfg: ModerationConfig): { text: string; hit: FlagCategory[] } {
  if (!text || !cats.size) return { text, hit: [] }
  const d = detect(text, cfg)
  if (!d) return { text, hit: [] }
  const hit = d.categories.filter((c) => cats.has(c))
  if (!hit.length) return { text, hit: [] }
  let out = text
  for (const c of hit) {
    if (c === 'caps') { out = out.toLowerCase(); continue }
    if (c === 'repetition') { out = out.replace(/(.)\1{3,}/gu, '$1$1$1'); continue }
    const terms = c === 'spam' ? [...(cfg.lists.spam ?? [])] : [...(cfg.lists[c as ListCategory] ?? [])]
    for (const term of terms) {
      const key = term.trim()
      if (!key) continue
      if (!reCache.has(key)) reCache.set(key, termRegex(key))
      const re = reCache.get(key)
      if (re) { re.lastIndex = 0; out = out.replace(re, '***') }
    }
    if (c === 'spam') out = out.replace(/https?:\/\/[^\s]+|www\.[^\s]+/gi, '***')
  }
  return { text: out, hit }
}

