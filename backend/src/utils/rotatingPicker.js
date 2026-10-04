// Used by bulk mock-test generation (mockBuilderController) to spread question
// reuse evenly across a large batch of tests instead of letting pure-random
// picks (one fresh Math.random() shuffle per test) cluster by chance on the
// same lucky subset of the pool while other questions never get used.
//
// For one (subject, poolClassLevels) combination, loads the pool ONCE, lays it
// out as a single chapter-interleaved sequence (round-robin across chapters,
// shuffled), and hands out consecutive slices of that sequence to successive
// `take(n)` calls. When the sequence runs out it is rebuilt (chapters
// re-shuffled, not just re-walked in the same order) and handed out again —
// so every question in the pool gets used the same number of times, give or
// take one, however many tests draw from this pool across the whole run.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Chapter round-robin: one pass takes the 1st question of every chapter (in a
// shuffled chapter order), then the 2nd of every chapter, and so on — so a
// test built from an early slice of the sequence still spans chapters evenly,
// matching the existing single-test pickBalanced() behavior.
function buildInterleavedSequence(pool) {
  const byChapter = {};
  for (const q of pool) {
    (byChapter[q.chapter] = byChapter[q.chapter] || []).push(q);
  }
  for (const ch of Object.keys(byChapter)) byChapter[ch] = shuffle(byChapter[ch]);
  const chapters = shuffle(Object.keys(byChapter));

  const seq = [];
  let round = 0;
  let remaining = pool.length;
  while (remaining > 0) {
    for (const ch of chapters) {
      const bucket = byChapter[ch];
      if (bucket.length > round) {
        seq.push(bucket[round]);
        remaining--;
      }
    }
    round++;
  }
  return seq;
}

// prisma: an instantiated PrismaClient. Returns { size, take(n) }.
async function createRotatingPool(prisma, subject, poolClassLevels) {
  const pool = await prisma.question.findMany({
    where: { subject, classLevel: { in: poolClassLevels } },
    select: { id: true, chapter: true },
  });

  let sequence = pool.length ? buildInterleavedSequence(pool) : [];
  let cursor = 0;

  return {
    size: pool.length,
    take(n) {
      const out = [];
      if (pool.length === 0) return out;
      while (out.length < n) {
        if (cursor >= sequence.length) {
          sequence = buildInterleavedSequence(pool); // reshuffle for the next lap
          cursor = 0;
        }
        out.push(sequence[cursor++]);
      }
      return out;
    },
  };
}

module.exports = { createRotatingPool, shuffle };
