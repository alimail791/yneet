// CBSE Class 12 *board* previous-year questions were imported into the same
// questions table with isPYQ + pyqYear set (Railway one-off jobs
// pyq-import-once / pyq-import-physics) and ids starting "pyq". They are not
// NEET questions, so anything that says "NEET PYQ", counts NEET papers or
// computes NEET weightage must leave them out. Students still practise them;
// they're shown as "CBSE <year> Board" instead. (No schema change: the id
// prefix is the marker.)
const BOARD_ID_PREFIX = "pyq";

// Prisma where-fragment: not a CBSE board question.
const NOT_BOARD = { NOT: { id: { startsWith: BOARD_ID_PREFIX } } };
const isBoardQuestion = (q) => String(q?.id || "").startsWith(BOARD_ID_PREFIX);
const isNeetPyq = (q) => !!q?.isPYQ && !isBoardQuestion(q);

// For API responses: a board question stops claiming to be a NEET PYQ and
// carries boardYear/source for a "CBSE 2023 Board" label instead.
const labelSource = (q) => {
  if (!q || !isBoardQuestion(q) || !q.isPYQ) return q;
  return { ...q, isPYQ: false, isRepeated: false, pyqYear: null, boardYear: q.pyqYear ?? null, source: "CBSE Board" };
};

module.exports = { BOARD_ID_PREFIX, NOT_BOARD, isBoardQuestion, isNeetPyq, labelSource };
