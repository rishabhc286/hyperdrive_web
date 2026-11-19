/** Renders `backtick`-delimited spans of a plain string as inline <code>. */
export function renderInlineCode(text: string) {
  return text.split("`").map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="font-mono text-[0.92em] text-ink">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
