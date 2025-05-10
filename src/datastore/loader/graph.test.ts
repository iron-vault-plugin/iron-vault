import { jest } from "@jest/globals";
import { computed, effect, signal, Signal } from "@preact/signals-core";
import { CampaignInput } from "campaigns/entity";
import { produce } from "immer";
import { Right } from "utils/either";
import * as yaml from "yaml";
import { PLUGIN_KIND_FIELD } from "../../constants";
import {
  campaignAssignment,
  equalitySignal,
  File,
  FileKind,
  Graph,
  memoizeWeak,
  onlyChanges,
  withPrevious,
} from "./graph";

describe("equalitySignal", () => {
  it("should only update when the value changes", () => {
    const value = { foo: "bar" };
    const s = equalitySignal(value, (a, b) => a.foo === b.foo);
    expect(s.value).toBe(value);
    s.value = { foo: "bar" }; // No change
    expect(s.value).toBe(value); // No change
    s.value = { foo: "baz" }; // Change
    expect(s.value).not.toBe(value); // Change in s
    expect(s.value).toEqual({ foo: "baz" }); // Change in s
  });
});

function createFile({
  path,
  filerev,
  content,
  kind,
}: {
  kind: keyof FileKind;
  path: string;
  filerev?: string;
  content?: Record<string, unknown>;
}): File {
  return {
    path: path,
    filerev: filerev || "12345",
    content:
      content === undefined
        ? "misc text"
        : `---\n${yaml.stringify({ ...content, [PLUGIN_KIND_FIELD]: kind })}\n---\n\nmisc text`,
  };
}

function createCampaign({
  path,
  content,
}: {
  path: string;
  content?: Partial<CampaignInput>;
}) {
  const { ironvault, ...rest } = content || {};
  return createFile({
    path,
    kind: "campaign",
    content: {
      ironvault: {
        playset: {
          type: "registry",
          key: "starforged",
        },
        ...(ironvault || {}),
      },
      ...rest,
    },
  });
}

function createInvalidCampaign({ path }: { path: string }) {
  return createFile({
    path,
    kind: "campaign",
    content: {},
  });
}

describe("Graph", () => {
  it("getAllNodes", () => {
    const graph = new Graph();
    const file: File = createCampaign({
      path: "test.txt",
    });
    const results: string[][] = [];

    effect(() => {
      const nodes = graph.getAllNodes("@file").value;
      results.push([...nodes.values()]);
    });

    expect(results).toEqual([[]]);

    graph.addOrUpdateFile(file);
    expect(results).toEqual([[], ["test.txt"]]);

    // Adding the exact same file content again should not trigger a change
    graph.addOrUpdateFile(file);
    expect(results).toEqual([[], ["test.txt"]]);

    // Nor should changing the content
    file.content = '{"asdf": "new"}';
    graph.addOrUpdateFile(file);
    expect(results).toEqual([[], ["test.txt"]]);
  });
});

describe("campaignAssignment", () => {
  it("should return the correct campaign assignment", () => {
    const graph = new Graph();
    graph.addOrUpdateFile(createCampaign({ path: "c1/index.md" }));
    graph.addOrUpdateFile(createCampaign({ path: "c2/index.md" }));

    const character = graph.addOrUpdateFile(
      createFile({ kind: "character", path: "c1/Characters/Alice.md" }),
    );

    const sig = campaignAssignment(graph)(character);
    expect(sig.value).toBe("c1");
  });

  it("should trigger if the root changes", () => {
    const graph = new Graph();

    const character = graph.addOrUpdateFile(
      createFile({ kind: "character", path: "c1/Characters/Alice.md" }),
    );

    const fn = jest.fn();

    const sig = campaignAssignment(graph)(character);
    expect(sig.value).toBe(undefined);
    sig.subscribe(fn);

    graph.addOrUpdateFile(createCampaign({ path: "c2/index.md" }));
    graph.addOrUpdateFile(createCampaign({ path: "c3/index.md" }));
    expect(fn).toHaveBeenCalledWith(undefined);
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();

    graph.addOrUpdateFile(createInvalidCampaign({ path: "c1/index.md" }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c1");

    fn.mockClear();
    graph.addOrUpdateFile(createCampaign({ path: "c4/index.md" }));
    expect(fn).toHaveBeenCalledTimes(0);
    expect(sig.value).toBe("c1");

    // If we have a conflict, we should return undefined
    // TODO: maybe this should return an error instead?
    graph.addOrUpdateFile(createCampaign({ path: "index.md" }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(undefined);
  });
});

describe("onlyChanges", () => {
  it("should only propagate changes when the value changes", () => {
    const value = { foo: "bar" };
    const s = signal(value);
    const c = onlyChanges(s, (a, b) => a.foo === b.foo);
    expect(c.value).toBe(value);

    s.value = { foo: "bar" }; // No change
    expect(s.value).not.toBe(value); // Change in s
    expect(c.value).toBe(value); // No change in c
  });
});

describe("campaign", () => {
  it("parses campaign nodes", () => {
    const graph = new Graph();
    const file: File = createFile({
      path: "test.txt",
      content: {
        ironvault: {
          playset: {
            type: "registry",
            key: "starforged",
          },
        },
        name: "test",
      },
      kind: "campaign",
    });
    graph.addOrUpdateFile(file);

    const node = graph.getNode("campaign", file.path)!;
    expect(node).toBeDefined();

    const fn = jest.fn();
    node.subscribe(fn);

    expect(fn).toHaveBeenCalledWith(
      Right.create({
        ironvault: {
          playset: {
            type: "registry",
            key: "starforged",
          },
        },
        name: "test",
      }),
    );
    expect(fn).toHaveBeenCalledTimes(1);
    fn.mockClear();

    graph.addOrUpdateFile({
      ...file,
      content: JSON.stringify({
        name: "test2",
      }),
    });
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.anything(),
      }),
    );
  });
});

describe("withPrevious", () => {
  it("should return the previous value", () => {
    const s = signal(0);
    const prev = withPrevious((v) => s.value + v, 0);

    expect(prev.value).toBe(0);

    s.value = 1;
    expect(prev.value).toBe(1);

    s.value = 2;
    expect(prev.value).toBe(3); // 2 + 1
  });

  it("should work with produce from immer", () => {
    const s = signal<Record<string, number>>({});
    const prev = withPrevious<Record<string, number>>(
      produce((draft) => {
        for (const [k, v] of Object.entries(s.value)) {
          draft[k] = v + 1;
        }
      }),
      {},
    );
    expect(prev.value).toEqual({});
    s.value = { a: 1 };
    const newValue = prev.value;
    expect(newValue).toEqual({ a: 2 });
    s.value = { a: 1 };
    expect(prev.value).toBe(newValue); // Returns the same object
  });
});

describe("memoize", () => {
  const testDep = (param: Signal<File>) =>
    computed(() => {
      return param.value.path;
    });

  function makeSignal() {
    return signal<File>(createFile({ kind: "campaign", path: "test.txt" }));
  }

  it("should create a signal that returns the expected value", () => {
    const s = makeSignal();
    const memoized = memoizeWeak(testDep);
    expect(memoized(s).value).toBe("test.txt");
  });

  it("should reuse the existing signal", () => {
    const s = makeSignal();
    const memoized = memoizeWeak(testDep);
    const signal1 = memoized(s);
    const signal2 = memoized(s);
    expect(signal1).toBe(signal2);

    const s2 = makeSignal();
    const signal3 = memoized(s2);
    expect(signal3).not.toBe(signal1);
  });
});
