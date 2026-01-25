/**
 * Image utility functions for handling responsive images and format variations
 */

export interface ResponsiveImageSizes {
  small: {
    webp: string;
    avif: string;
  };
  medium: {
    webp: string;
    avif: string;
  };
  large: {
    webp: string;
    avif: string;
  };
}

// Helper to ensure HTTPS for production URLs
function ensureHttps(url: string): string {
  if (!url) return url;
  // If it's http and NOT localhost, force https
  if (url.startsWith('http://') && !url.includes('localhost')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

/**
 * Generate responsive image URLs from a base thumbnail URL
 * Handles both new optimized images and legacy images
 */
export function getResponsiveImageUrls(originalUrl: string): ResponsiveImageSizes | null {
  if (!originalUrl) return null;

  // Ensure we use HTTPS
  const thumbnailUrl = ensureHttps(originalUrl);

  // Check if this is an optimized image (contains -medium, -small, or -large)
  const isOptimized = /-(?:small|medium|large)\.(?:webp|avif)$/.test(thumbnailUrl);
  
  if (!isOptimized) {
    // Legacy image - return null to use original URL
    return null;
  }

  // Extract base URL (remove size and extension)
  const baseUrl = thumbnailUrl.replace(/-(?:small|medium|large)\.(?:webp|avif)$/, '');

  return {
    small: {
      webp: `${baseUrl}-small.webp`,
      avif: `${baseUrl}-small.avif`
    },
    medium: {
      webp: `${baseUrl}-medium.webp`,
      avif: `${baseUrl}-medium.avif`
    },
    large: {
      webp: `${baseUrl}-large.webp`,
      avif: `${baseUrl}-large.avif`
    }
  };
}

/**
 * Generate srcset string for responsive images
 */
export function generateSrcSet(sizes: ResponsiveImageSizes, format: 'webp' | 'avif'): string {
  return [
    `${sizes.small[format]} 400w`,
    `${sizes.medium[format]} 800w`,
    `${sizes.large[format]} 1200w`
  ].join(', ');
}

/**
 * Get the primary image URL (medium WebP for backward compatibility)
 */
export function getPrimaryImageUrl(originalUrl: string): string {
  if (!originalUrl) return '';

  // Ensure we use HTTPS
  const thumbnailUrl = ensureHttps(originalUrl);
  
  // If already optimized, return as is
  if (/-medium\.webp$/.test(thumbnailUrl)) {
    return thumbnailUrl;
  }
  
  // If it's a different size/format, convert to medium webp
  if (/-(?:small|large)\.(?:webp|avif)$/.test(thumbnailUrl) || /-medium\.avif$/.test(thumbnailUrl)) {
    return thumbnailUrl.replace(/-(?:small|medium|large)\.(?:webp|avif)$/, '-medium.webp');
  }
  
  // Legacy image - return as is
  return thumbnailUrl;
}
