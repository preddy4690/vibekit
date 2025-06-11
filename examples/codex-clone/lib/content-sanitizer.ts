/**
 * Content sanitization utilities for safe markdown rendering
 */

// List of known safe HTML tags that should be preserved for markdown
const SAFE_HTML_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'cite', 'code', 'dd', 'del', 'details', 'dfn', 'div',
  'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd',
  'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var'
];

// Known problematic patterns that should be removed
const PROBLEMATIC_PATTERNS = [
  /<\/?safecodeblock[^>]*>/gi,
  /<\/?signup[^>]*>/gi,
  /<\/?antml:[^>]*>/gi,
  /<\/?function_calls[^>]*>/gi,
  /<\/?augment_code_snippet[^>]*>/gi,
  /<\/?invoke[^>]*>/gi,
  /<\/?parameter[^>]*>/gi,
];

/**
 * Sanitizes content by removing potentially problematic HTML-like tags
 * while preserving safe markdown-compatible tags
 */
export function sanitizeMarkdownContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let sanitized = content;

  // First pass: Remove known problematic patterns
  for (const pattern of PROBLEMATIC_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Second pass: Remove any remaining unsafe HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, (match) => {
    // Preserve markdown code blocks
    if (match.startsWith('```') || match.endsWith('```')) {
      return match;
    }

    // Extract tag name
    const tagMatch = match.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    if (!tagMatch) {
      return ''; // Remove malformed tags
    }

    const tagName = tagMatch[1].toLowerCase();
    
    // Preserve safe HTML tags
    if (SAFE_HTML_TAGS.includes(tagName)) {
      return match;
    }

    // Remove unsafe tags
    return '';
  });

  // Third pass: Clean up any remaining problematic content
  sanitized = sanitized
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  return sanitized;
}

/**
 * Validates if content contains potentially problematic tags
 */
export function hasProblematicTags(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  return PROBLEMATIC_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Extracts problematic tags from content for debugging
 */
export function extractProblematicTags(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const found: string[] = [];
  
  // Look for any HTML-like tags that aren't in the safe list
  const tagMatches = content.match(/<[^>]+>/g) || [];
  
  for (const tag of tagMatches) {
    const tagMatch = tag.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    if (tagMatch) {
      const tagName = tagMatch[1].toLowerCase();
      if (!SAFE_HTML_TAGS.includes(tagName) && !found.includes(tagName)) {
        found.push(tagName);
      }
    }
  }

  return found;
}
