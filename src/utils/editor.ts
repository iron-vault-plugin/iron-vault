import { Editor, EditorPosition, EditorRange } from "obsidian";

/** Yields editor lines and their index in reverse order starting at the start position. */
export function* reverseLineIterator(
  editor: Editor,
  startPos: EditorPosition,
): Generator<[string, number], void> {
  let lineNum = startPos.line;
  // Hmm-- should this start at the cursor in the middle of the line or not?
  //let line = editor.getLine(startPos.line).slice(0, startPos.ch);
  const line = editor.getLine(lineNum);

  yield [line, lineNum];

  while (lineNum > 0) {
    lineNum -= 1;
    yield [editor.getLine(lineNum), lineNum];
  }
}

export function findFirstNonWhitespace(
  lines: Iterator<[string, number]>,
): [string, number] | null {
  let step = lines.next();
  while (!step.done) {
    const [line, lineNum] = step.value;
    if (line.trimEnd() != "") return [line, lineNum];
    step = lines.next();
  }
  return null;
}

const CODE_BLOCK_START_REGEX = /^\s*```\s*(\w*)\s*[^`]*$/;

// Note that this does not currently look for code blocks in callouts (grimace)
/** Searches for a whitespace-separated code block.
 * @param lines line and line number in reverse order
 * @returns the start and end of the code block (including start and end lines entirely), or null if no adjacent code block exists
 */
export function findAdjacentCodeBlock(
  lines: Iterable<[string, number]>,
  blockType?: string,
): EditorRange | null {
  const iterator = lines[Symbol.iterator]();
  const lineIterable: Iterable<[string, number]> = {
    [Symbol.iterator]: () => iterator,
  };
  const [lastLine, lastLineNum] = findFirstNonWhitespace(iterator) ?? [];

  // If no first non-whitespace line, no code block to find.
  if (lastLine == null || lastLineNum == null) return null;

  // If this isn't a code block closer, there is no adjacent code block.
  if (lastLine.trim() !== "```") return null;

  for (const [line, lineNum] of lineIterable) {
    const match = line.match(CODE_BLOCK_START_REGEX);
    if (match) {
      // This is a code block start
      if (!blockType || match[1] == blockType) {
        return {
          from: { line: lineNum, ch: 0 },
          to: { line: lastLineNum + 1, ch: 0 },
        };
      } else {
        // But not our code block, so abandon hope.
        return null;
      }
    }
  }

  // We never found the start of this code block, huh
  // TODO: we might be in one? hrm.
  return null;
}

/** Returns the interior of a code block range.
 * When replacing this range, ALWAYS include a newline.
 */
export function interiorRange(codeBlockRange: EditorRange): EditorRange {
  const fromLine = codeBlockRange.from.line + 1;
  const toLine = codeBlockRange.to.line - 1;
  if (fromLine > toLine) {
    throw new Error(`Invalid code block range ${codeBlockRange}`);
  }
  return {
    from: { line: fromLine, ch: 0 },
    to: { line: toLine, ch: 0 },
  };
}

export function updateCodeBlockInterior(
  editor: Editor,
  codeBlockRange: EditorRange,
  updating: (current: string) => string,
) {
  const interior = interiorRange(codeBlockRange);
  const current = editor.getRange(interior.from, interior.to);
  const updated = updating(current);
  editor.replaceRange(
    updated ? updated + "\n" : "",
    interior.from,
    interior.to,
  );
}

export function splitTextIntoReverseLineIterator(
  text: string,
): Iterable<[string, number]> {
  return text
    .split("\n")
    .map((line, idx): [string, number] => [line, idx])
    .reverse();
}
