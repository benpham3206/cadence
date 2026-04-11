export function shouldUseAPI(apiMode, hasCache, hasKey) {
  if (!hasKey) return false;
  if (hasCache) return false;
  if (apiMode === 'manual') return false;
  return true;
}
