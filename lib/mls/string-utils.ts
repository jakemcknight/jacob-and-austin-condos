// String similarity utilities for address matching

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Deletion
        matrix[i][j - 1] + 1, // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1 range, 1 = identical)
 */
export function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1;

  return 1 - distance / maxLength;
}
