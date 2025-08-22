/**
 * Calculate dimensions to fit a media box inside a container while preserving aspect ratio.
 * Letterboxes the media when container and media aspect ratios differ.
 */
export function fitRect(
  container: { width: number; height: number },
  media: { width: number; height: number }
): { width: number; height: number } {
  const cAspect = container.width / container.height;
  const mAspect = media.width / media.height;

  if (!container.width || !container.height || !media.width || !media.height) {
    return { width: 0, height: 0 };
  }

  if (cAspect > mAspect) {
    const height = container.height;
    const width = height * mAspect;
    return { width, height };
  }

  const width = container.width;
  const height = width / mAspect;
  return { width, height };
}

export default fitRect;
