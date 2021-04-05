const transferCache = new Map<string, number>();

export const getTotalTransferFor = (key: string, value: number) => {
  const cacheValue = transferCache.get(key) || 0;
  const shouldReset = cacheValue + value < Number.MAX_SAFE_INTEGER;
  const total = shouldReset ? cacheValue + value : value;
  transferCache.set(key, total);
  return total;
};
