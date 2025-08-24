/**
 * Account page basic render test.
 * Run with: npm test
 */
import assert from "node:assert";
import test from "node:test";
import { renderToString } from "react-dom/server";
import AccountPage from "../account/page";
import ToastProvider from "@/providers/ToastProvider";

test("AccountPage renders without crashing", () => {
  const html = renderToString(
    <ToastProvider>
      <AccountPage />
    </ToastProvider>,
  );
  assert.equal(html, "");
});

test("AccountPage falls back without Intl.supportedValuesOf", () => {
  const original = (Intl as any).supportedValuesOf;
  // @ts-ignore remove to simulate older environments
  delete (Intl as any).supportedValuesOf;
  assert.doesNotThrow(() => {
    renderToString(
      <ToastProvider>
        <AccountPage />
      </ToastProvider>,
    );
  });
  (Intl as any).supportedValuesOf = original;
});
