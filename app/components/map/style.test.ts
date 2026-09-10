import { describe, expect, it } from "vitest";
import { ICON_IDS } from "./icons";
import { INTERACTIVE_LAYERS, LAYER_GROUPS, buildStyle } from "./style";
import { mapContent } from "~/data/map";

describe("map style", () => {
  const style = buildStyle(mapContent(), []);
  const ids = style.layers.map((l) => l.id);

  it("has unique layer ids", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every layer draws from a declared source", () => {
    for (const layer of style.layers) {
      if (layer.type === "background") continue;
      expect(style.sources, layer.id).toHaveProperty(layer.source);
    }
  });

  it("every legend group and interactive layer names a real layer", () => {
    for (const [group, layers] of Object.entries(LAYER_GROUPS)) {
      for (const id of layers) expect(ids, `${group} → ${id}`).toContain(id);
    }
    for (const id of INTERACTIVE_LAYERS) expect(ids).toContain(id);
  });

  it("every literal icon-image exists", () => {
    for (const layer of style.layers) {
      const icon = layer.type === "symbol" ? layer.layout?.["icon-image"] : undefined;
      if (typeof icon === "string") expect(ICON_IDS as readonly string[], layer.id).toContain(icon);
    }
  });
});
