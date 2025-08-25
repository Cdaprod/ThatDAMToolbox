import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import React from 'react';

const modalPath = path.resolve(__dirname, '../../../../providers/ModalProvider.js');
const modalMod = require(modalPath);

/**
 * Verify provisioning modal trigger from access control page.
 * Run with: npm test
 */
test('Provision Device button opens provisioning modal', async () => {
  let opened: string | null = null;
  modalMod.useModal = () => ({ openModal: (tool: string) => { opened = tool; }, closeModal() {} });
  const pagePath = path.resolve(__dirname, '../page.js');
  delete require.cache[pagePath];
  const { default: Page } = await import('../page');
  const el = Page({ params: { tenant: 't1' } });
  const header = el.props.children[0];
  const buttonStack = header.props.children[1];
  const provisionBtn = buttonStack.props.children[0];
  provisionBtn.props.onClick();
  modalMod.useModal = () => ({ openModal() {}, closeModal() {} });
  delete require.cache[pagePath];
  assert.equal(opened, 'provision-device');
});
