/**
 * Minimal MinIO helper functions.
 * Example:
 *   const url = await getPresignedGet('object-key', { expiresSeconds: 3600 });
 */
export async function getPresignedGet(
  key: string,
  opts: { expiresSeconds: number },
): Promise<string> {
  const baseUrl = process.env.MINIO_BASE_URL || 'http://minio.local';
  return `${baseUrl}/${encodeURIComponent(key)}?expires=${opts.expiresSeconds}`;
}
