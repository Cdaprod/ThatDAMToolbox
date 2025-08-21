/**
 * AssetsPage integration: renders list when API returns data.
 * Run with: npm test
 */
import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AssetsPage from "../page";

(global as any).fetch = async (input: any) => {
  const url = input.toString();
  assert.equal(url, "/api/assets?limit=100");
  return {
    ok: true,
    json: async () => ({ items: [{ id: "1", name: "Asset 1" }] }),
  } as any;
};

test("AssetsPage renders asset list", async () => {
  const html = renderToStaticMarkup(await AssetsPage());
  assert.ok(html.includes("<li"));
  assert.ok(html.includes("Asset 1"));
});
