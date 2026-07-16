import React from 'react';

/**
 * Announcements can carry a single legacy image (`imageUrl`) and/or a JSON
 * array of extra images (`images`). Normalise both into one ordered list of
 * sources so the modal and the list page render them identically.
 */
export function parseImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) return parsed.filter(x => typeof x === 'string');
  } catch {
    // not JSON — assume CSV
  }
  return images.split(',').map(s => s.trim()).filter(Boolean);
}

/** Combine the legacy single image with the multi-image field, in display order. */
export function announcementImages(imageUrl: string | null | undefined, images: string | null | undefined): string[] {
  return imageUrl ? [imageUrl, ...parseImages(images)] : parseImages(images);
}

/**
 * Render an announcement body as React nodes, turning `*…*` spans into bold
 * text while preserving line breaks (pair the output with `whitespace-pre-line`).
 * A lone `*` or an unclosed `*` is left untouched so ordinary text is safe.
 */
export function renderAnnouncementBody(text: string): React.ReactNode {
  if (!text) return null;
  // Split into alternating plain / *bold* segments. `[^*\n]+` keeps a span on
  // a single line so a stray asterisk never swallows the rest of the message.
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
