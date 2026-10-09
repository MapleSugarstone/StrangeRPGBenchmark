// Reading level of plain text by the Flesch-Kincaid grade formula, for the Guide's readability check.

/** Syllables in one word, by vowel groups. Numbers count one syllable per digit up to three, and a percent sign adds two. */
export function syllables(word: string): number {
  if (/\d/.test(word)) {
    const digits = word.replace(/\D/g, '').length;
    return Math.min(3, Math.max(1, digits)) + (word.includes('%') ? 2 : 0);
  }
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, m => m[0]).replace(/^y/, '');
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export interface Score { words: number; sentences: number; syllables: number; grade: number }

/** Scores a list of texts, each made of whole sentences. A sentence ends at a period, question mark, or exclamation mark after a word. */
export function score(texts: string[]): Score {
  let words = 0, sentences = 0, syl = 0;
  for (const t of texts) {
    const parts = t.split(/(?<=[A-Za-z0-9%')])[.!?](?=\s|$)/).map(s => s.trim()).filter(Boolean);
    for (const s of parts) {
      const ws = s.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
      if (!ws.length) continue;
      sentences++;
      words += ws.length;
      for (const w of ws) syl += w.split('-').reduce((n, part) => n + syllables(part), 0);
    }
  }
  const grade = words && sentences ? 0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59 : 0;
  return { words, sentences, syllables: syl, grade };
}

/** The highest grade a Guide chapter may score. */
export const GRADE_MAX = 4;
