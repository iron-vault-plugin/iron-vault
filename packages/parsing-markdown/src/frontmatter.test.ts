import { unwrap, unwrapErr } from "true-myth/test-support";
import { describe, expect, it } from "vitest";
import { extractFrontmatter } from "./frontmatter";

describe("extractFrontmatter", () => {
  it("returns undefined for content without frontmatter", () => {
    const content = "This is just regular content without frontmatter";
    const result = extractFrontmatter(content);
    expect(unwrap(result)).toBeUndefined();
  });

  it("correctly extracts valid frontmatter", () => {
    const content =
      "---\ntitle: Test Document\nauthor: John Doe\n---\nContent after frontmatter";
    const result = extractFrontmatter(content);
    expect(unwrap(result)).toEqual({
      title: "Test Document",
      author: "John Doe",
    });
  });

  it("returns an error for frontmatter without terminator", () => {
    const content =
      "---\ntitle: Test Document\nauthor: John Doe\nContent without terminator";
    const result = extractFrontmatter(content);
    expect(unwrapErr(result).message).toContain("no terminator found");
  });

  it("returns an error for invalid YAML in frontmatter", () => {
    const content =
      "---\ntitle: 'Unterminated string\nauthor: John Doe\n---\nContent";
    const result = extractFrontmatter(content);
    expect(unwrapErr(result).message).toContain("Missing closing 'quote");
  });

  it("correctly parses complex frontmatter with nested objects and arrays", () => {
    const content = `---
title: Complex Document
authors:
  - name: John
    email: john@example.com
  - name: Jane
    email: jane@example.com
settings:
  published: true
  categories:
    - tech
    - programming
---
Content starts here`;

    const result = extractFrontmatter(content);
    expect(unwrap(result)).toEqual({
      title: "Complex Document",
      authors: [
        { name: "John", email: "john@example.com" },
        { name: "Jane", email: "jane@example.com" },
      ],
      settings: {
        published: true,
        categories: ["tech", "programming"],
      },
    });
  });

  it("correctly handles empty frontmatter", () => {
    const content = "---\n---\nContent after empty frontmatter";
    const result = extractFrontmatter(content);
    expect(unwrap(result)).toEqual({});
  });
});
