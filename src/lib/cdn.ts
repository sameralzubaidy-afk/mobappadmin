export const getCdnUrlFromPublicUrl = (publicUrl: string): string => {
  const cdn = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdn) return publicUrl;

  try {
    const u = new URL(publicUrl);
    const idx = u.pathname.indexOf('/storage/v1/object/public');
    if (idx === -1) return publicUrl;
    const suffix = u.pathname.substring(idx + '/storage/v1/object/public'.length);
    const pathSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `${cdn}${pathSuffix}`;
  } catch (e) {
    return publicUrl;
  }
};
