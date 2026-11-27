import type { CategoryOption } from './types'

export const CATEGORIES: CategoryOption[] = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' },
  { id: '29', name: 'Nonprofits & Activism' },
]

export const REGIONS: { code: string; name: string }[] = [
  { code: '', name: 'Any region' },
  { code: 'US', name: 'United States' },
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CO', name: 'Colombia' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'TH', name: 'Thailand' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'IT', name: 'Italy' },
  { code: 'PL', name: 'Poland' },
]

export const LANGUAGES: { code: string; name: string }[] = [
  { code: '', name: 'Any language' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'it', name: 'Italian' },
]

export const SUGGESTIONS = [
  'blender',
  'ted',
  'python',
  'minecraft',
  '4K',
  'kurzgesagt',
  'queen',
  'lofi',
]

export function categoryName(id: string, categories: CategoryOption[] = CATEGORIES): string {
  return categories.find((category) => category.id === id)?.name ?? (id ? `Category ${id}` : 'Any category')
}

export function regionName(code: string): string {
  return REGIONS.find((region) => region.code === code)?.name ?? code
}

export function languageName(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.name ?? code
}
