import * as mdast from "mdast";
import { cut } from "./branching";
import { Sentence, sentence, sentenceToString } from "./markdown";
import { runParser } from "./parser";
import { repeat } from "./sequences";

function t(value: string): mdast.Text {
  return { type: "text", value };
}

function emph(...children: mdast.PhrasingContent[]): mdast.Emphasis {
  return { type: "emphasis", children };
}

function s(...parts: mdast.PhrasingContent[]): Sentence {
  return { parts };
}

describe("sentence parser", () => {
  test.each<{
    name: string;
    input: mdast.PhrasingContent[];
    expected: Sentence[];
  }>([
    {
      name: "simple text without sentence breaks",
      input: [t("This is a simple text without period")],
      expected: [s(t("This is a simple text without period"))],
    },
    {
      name: "text with a sentence break",
      input: [t("This is a sentence. This is another one")],
      expected: [s(t("This is a sentence.")), s(t(" This is another one"))],
    },
    {
      name: "emphasis nodes with no sentence break",
      input: [emph(t("emphasized text"))],
      expected: [s(emph(t("emphasized text")))],
    },
    {
      name: "emphasis nodes with a sentence break",
      input: [emph(t("emphasized text. more text"))],
      expected: [s(emph(t("emphasized text."))), s(emph(t(" more text")))],
    },
    {
      name: "text with multiple sentence breaks",
      input: [
        t("First sentence."),
        t("Second sentence. Third sentence."),
        t("Fourth sentence."),
      ],
      expected: [
        s(t("First sentence.")),
        s(t("Second sentence.")),
        s(t(" Third sentence.")),
        s(t("Fourth sentence.")),
      ],
    },
    {
      name: "mixed content with emphasis and text",
      input: [t("This is "), emph(t("important")), t(" text. And more text.")],
      expected: [
        s(t("This is "), emph(t("important")), t(" text.")),
        s(t(" And more text.")),
      ],
    },
    {
      name: "nested emphasis with sentence breaks",
      input: [
        t("This is "),
        emph(t("important")),
        t(" text. And more text."),
        emph(t("Another emphasized part.")),
      ],
      expected: [
        s(t("This is "), emph(t("important")), t(" text.")),
        s(t(" And more text.")),
        s(emph(t("Another emphasized part."))),
      ],
    },
    {
      name: "text with multiple emphasis nodes",
      input: [
        t("This is "),
        emph(t("first emphasized")),
        t(" and "),
        emph(t("second emphasized")),
        t(" text."),
      ],
      expected: [
        s(
          t("This is "),
          emph(t("first emphasized")),
          t(" and "),
          emph(t("second emphasized")),
          t(" text."),
        ),
      ],
    },
    {
      name: "line break as sentence end",
      input: [
        t("This is a sentence with a line break"),
        { type: "break" } as mdast.Break,
        t("and this is another sentence."),
      ],
      expected: [
        s(t("This is a sentence with a line break"), { type: "break" }),
        s(t("and this is another sentence.")),
      ],
    },
  ])("$name", ({ input, expected }) => {
    const result = runParser(
      repeat(undefined, undefined, cut(sentence)),
      ...input,
    );
    expect(result.unwrap()).toEqual(expected);
  });
});

describe("sentenceToString", () => {
  function ic(value: string): mdast.InlineCode {
    return { type: "inlineCode", value };
  }

  function strong(...children: mdast.PhrasingContent[]): mdast.Strong {
    return { type: "strong", children };
  }

  function del(...children: mdast.PhrasingContent[]): mdast.Delete {
    return { type: "delete", children };
  }

  function br(): mdast.Break {
    return { type: "break" };
  }

  function link(): mdast.Link {
    // minimal link node
    return { type: "link", url: "https://example.com", children: [] };
  }

  function img(): mdast.Image {
    return { type: "image", url: "img.png", alt: null, title: null };
  }

  it("returns text for a simple sentence", () => {
    expect(sentenceToString({ parts: [t("Hello world.")] })).toBe(
      "Hello world.",
    );
  });

  it("joins multiple text nodes", () => {
    expect(sentenceToString({ parts: [t("Hello "), t("world.")] })).toBe(
      "Hello world.",
    );
  });

  it("handles inlineCode nodes", () => {
    expect(
      sentenceToString({ parts: [t("Run "), ic("npm test"), t(".")] }),
    ).toBe("Run npm test.");
  });

  it("handles break nodes as newlines", () => {
    expect(sentenceToString({ parts: [t("Line 1"), br(), t("Line 2")] })).toBe(
      "Line 1\nLine 2",
    );
  });

  it("handles emphasis nodes recursively", () => {
    expect(
      sentenceToString({
        parts: [t("This is "), emph(t("important")), t(".")],
      }),
    ).toBe("This is important.");
  });

  it("handles strong and delete nodes recursively", () => {
    expect(
      sentenceToString({
        parts: [
          t("Be "),
          strong(t("bold")),
          t(" and "),
          del(t("gone")),
          t("."),
        ],
      }),
    ).toBe("Be bold and gone.");
  });

  it("ignores link, image, and other non-text nodes", () => {
    expect(
      sentenceToString({
        parts: [t("See "), link(), t(" or "), img(), t(".")],
      }),
    ).toBe("See  or .");
  });

  it("handles nested emphasis and strong nodes", () => {
    expect(
      sentenceToString({
        parts: [
          t("This is "),
          emph(strong(t("very ")), t("important")),
          t("."),
        ],
      }),
    ).toBe("This is very important.");
  });

  it("returns empty string for empty parts", () => {
    expect(sentenceToString({ parts: [] })).toBe("");
  });
});
