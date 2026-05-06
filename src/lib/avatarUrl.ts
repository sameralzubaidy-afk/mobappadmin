import { getCdnUrlFromPublicUrl } from './cdn';

const AVATAR_BUCKET = 'user-avatars';
const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const buildAbsoluteSupabaseUrl = (pathAfterPublicRoot: string): string | null => {
  if (!SUPABASE_PUBLIC_URL) return null;

  const baseUrl = SUPABASE_PUBLIC_URL.replace(/\/+$/, '');
  const cleanPath = pathAfterPublicRoot.replace(/^\/+/, '');

  if (!cleanPath) return null;

  return `${baseUrl}/storage/v1/object/public/${cleanPath}`;
};

const encodePath = (path: string): string =>
  path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export function normalizeProfileAvatarUrl(
  avatarPathOrUrl: string | null | undefined
): string | null {
  if (!avatarPathOrUrl) return null;

  const raw = avatarPathOrUrl.trim();
  if (!raw) return null;

  if (/^data:/i.test(raw)) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return getCdnUrlFromPublicUrl(raw);
  }

  if (/^\/?storage\/v1\/object\/public\//i.test(raw)) {
    const pathAfterPublicRoot = raw.replace(/^\/?storage\/v1\/object\/public\//i, '');
    const absoluteUrl = buildAbsoluteSupabaseUrl(pathAfterPublicRoot);
    return absoluteUrl ? getCdnUrlFromPublicUrl(absoluteUrl) : null;
  }

  const normalizedPath = raw
    .replace(/^\/+/, '')
    .replace(/^storage\/v1\/object\/public\/user-avatars\//i, '')
    .replace(/^user-avatars\//i, '');

  const encodedPath = encodePath(normalizedPath);
  if (!encodedPath) return null;

  const absoluteUrl = buildAbsoluteSupabaseUrl(`${AVATAR_BUCKET}/${encodedPath}`);
  return absoluteUrl ? getCdnUrlFromPublicUrl(absoluteUrl) : null;
}