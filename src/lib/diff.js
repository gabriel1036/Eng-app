// Character-level diff (LCS) between what the user typed and the expected answer.
const norm = (s) => s.toLowerCase().normalize('NFC');

export function diffChars(typed, target) {
  const a = [...norm(typed)];
  const b = [...norm(target)];
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const typedMarks = [...typed].map((ch) => ({ ch, ok: false }));
  const targetMarks = [...target].map((ch) => ({ ch, ok: false }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      typedMarks[i].ok = true;
      targetMarks[j].ok = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { typedMarks, targetMarks, correct: a.join('').replace(/\s+/g, ' ').trim() === b.join('').replace(/\s+/g, ' ').trim() };
}

/** Rough similarity 0..1 used to suggest an SRS rating. */
export function similarity(typed, target) {
  const { targetMarks } = diffChars(typed, target);
  if (!targetMarks.length) return 0;
  return targetMarks.filter((c) => c.ok).length / targetMarks.length;
}
