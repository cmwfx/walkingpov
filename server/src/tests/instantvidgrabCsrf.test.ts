import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { test } from 'node:test';
import { verifyCsrfToken } from '../middleware/csrf.js';

function invoke(method: string, path: string) {
  let calledNext = false;
  let statusCode: number | null = null;
  const request = { method, path, headers: {}, cookies: {} } as Request;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  verifyCsrfToken(request, response, (() => { calledNext = true; }) as NextFunction);
  return { calledNext, statusCode };
}

test('only signed InstantVidGrab server callbacks bypass browser CSRF validation', () => {
  for (const path of [
    '/integrations/instantvidgrab/exchange',
    '/integrations/instantvidgrab/link',
    '/integrations/instantvidgrab/entitlements',
  ]) {
    assert.deepEqual(invoke('POST', path), { calledNext: true, statusCode: null });
  }

  for (const path of [
    '/integrations/instantvidgrab/authorize',
    '/integrations/instantvidgrab/resolve-video',
    '/integrations/instantvidgrab/exchange/extra',
  ]) {
    assert.deepEqual(invoke('POST', path), { calledNext: false, statusCode: 403 });
  }
});
