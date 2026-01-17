/**
 * Extract dog ID from event description token
 * Token format: #GROOMDOG:<dogId>
 */
export function extractDogIdFromDescription(description: string | undefined | null): string | null {
  if (!description) {
    return null;
  }

  const regex = /#GROOMDOG:([A-Za-z0-9_-]+)/;
  const match = description.match(regex);
  return match ? match[1] : null;
}

/**
 * Upsert dog token into description
 * If token exists, replace it. Otherwise append it.
 * Preserves existing description content.
 */
export function upsertDogToken(description: string | undefined | null, dogId: string): string {
  const currentDesc = description || '';
  const token = `#GROOMDOG:${dogId}`;
  
  // Remove existing token if present
  const withoutToken = removeDogToken(currentDesc);
  
  // If description was empty or only had token, return just the token
  if (!withoutToken.trim()) {
    return token;
  }
  
  // Otherwise append token to existing description
  return `${withoutToken}\n\n${token}`;
}

/**
 * Remove dog token from description
 */
export function removeDogToken(description: string | undefined | null): string {
  if (!description) {
    return '';
  }

  const regex = /#GROOMDOG:[A-Za-z0-9_-]+\s*/g;
  return description.replace(regex, '').trim();
}
