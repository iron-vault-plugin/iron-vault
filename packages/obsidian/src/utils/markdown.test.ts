import { describe, expect, it } from "vitest";
import { extractFrontmatter } from "./markdown";

describe("extractFrontmatter", () => {
  it("returns undefined for content without frontmatter", () => {
    const content = "This is just regular content without frontmatter";
    const result = extractFrontmatter(content);
    expect(result.unwrap()).toBeUndefined();
  });

  it("correctly extracts valid frontmatter", () => {
    const content =
      "---\ntitle: Test Document\nauthor: John Doe\n---\nContent after frontmatter";
    const result = extractFrontmatter(content);
    expect(result.unwrap()).toEqual({
      title: "Test Document",
      author: "John Doe",
    });
  });

  it("returns an error for frontmatter without terminator", () => {
    const content =
      "---\ntitle: Test Document\nauthor: John Doe\nContent without terminator";
    const result = extractFrontmatter(content);
    expect(result.unwrapError().message).toContain("no terminator found");
  });

  it("returns an error for invalid YAML in frontmatter", () => {
    const content =
      "---\ntitle: 'Unterminated string\nauthor: John Doe\n---\nContent";
    const result = extractFrontmatter(content);
    expect(result.unwrapError().message).toContain("Missing closing 'quote");
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
    expect(result.isRight()).toBe(true);
    expect(result.unwrap()).toEqual({
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
    expect(result.unwrap()).toEqual({});
  });
});
