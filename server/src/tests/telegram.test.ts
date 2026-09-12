import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTelegramConfigured, telegramMessageFor } from '../services/telegram.js';

test('Telegram alerts use fixed non-sensitive messages', () => {
  assert.equal(telegramMessageFor('payment_submitted'), 'CandidFan: New payment submitted for review.');
  assert.equal(telegramMessageFor('support_ticket_created'), 'CandidFan: New support ticket submitted.');
});

test('Telegram configuration requires a numeric chat ID and a bot token', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  try {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    assert.equal(isTelegramConfigured(), false);
    process.env.TELEGRAM_BOT_TOKEN = 'synthetic-token';
    process.env.TELEGRAM_CHAT_ID = '123456789';
    assert.equal(isTelegramConfigured(), true);
    process.env.TELEGRAM_CHAT_ID = 'not-a-chat-id';
    assert.equal(isTelegramConfigured(), false);
  } finally {
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = originalChatId;
  }
});
