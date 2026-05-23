import { beforeEach, describe, expect, it, vi } from "vitest";

const { determineCampaignContextMock, noticeMock, selectMock } = vi.hoisted(
  () => ({
    determineCampaignContextMock: vi.fn(),
    noticeMock: vi.fn(),
    selectMock: vi.fn(),
  }),
);

vi.mock("campaigns/manager", () => ({
  determineCampaignContext: determineCampaignContextMock,
}));

vi.mock("obsidian", () => ({
  MarkdownRenderer: { render: vi.fn() },
  MarkdownRenderChild: class {},
  Notice: noticeMock,
}));

vi.mock("../utils/suggest", () => ({
  CustomSuggestModal: { select: selectMock },
}));

import { generateEntityCommand } from "./command";

describe("generateEntityCommand", () => {
  beforeEach(() => {
    determineCampaignContextMock.mockReset();
    noticeMock.mockReset();
    selectMock.mockReset();
  });

  it("shows a notice instead of opening an empty entity picker", async () => {
    determineCampaignContextMock.mockResolvedValue({
      oracles: new Map(),
      rulesPackages: new Map(),
    });

    await generateEntityCommand({} as never, {} as never, {} as never);

    expect(selectMock).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(
      "No rollable entity types are available for the active ruleset. Entity generation may not be supported for Ironsworn Classic yet.",
    );
  });
});
