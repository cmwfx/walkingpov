import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacyMemberMigrationPage,
  type LegacyMigrationGrant,
  type LegacyMigrationStore,
} from '../services/instantvidgrabLegacyMemberMigration.js';

const userA = '123e4567-e89b-42d3-a456-426614174000';
const userB = '123e4567-e89b-42d3-a456-426614174001';
const grantA1 = '223e4567-e89b-42d3-a456-426614174000';
const grantA2 = '223e4567-e89b-42d3-a456-426614174001';
const grantB1 = '223e4567-e89b-42d3-a456-426614174002';

function makeStore(
  activeRows: Array<{ id: string; userId: string }>,
  grants: LegacyMigrationGrant[],
  users: Record<string, { email: string | null; emailConfirmedAt: string | null } | null>,
): LegacyMigrationStore {
  return {
    async readActiveGrantPage({ afterGrantId, limit }) {
      return activeRows
        .filter((grant) => !afterGrantId || grant.id > afterGrantId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .slice(0, limit);
    },
    async readGrantRowsForUsers(userIds) {
      return grants.filter((grant) => userIds.includes(grant.userId));
    },
    async readSourceUser(userId) {
      return users[userId] ?? null;
    },
  };
}

test('dry-run pages only active effective members and exposes opaque IDs, never email', async () => {
  const store = makeStore(
    [
      { id: grantA1, userId: userA },
      { id: grantA2, userId: userA },
      { id: grantB1, userId: userB },
    ],
    [
      { id: grantA1, userId: userA, state: 'active', version: 2 },
      { id: grantA2, userId: userA, state: 'suspended', version: '3' },
      { id: grantB1, userId: userB, state: 'active', version: 1 },
    ],
    {
      [userA]: { email: 'MEMBER@example.invalid', emailConfirmedAt: '2026-01-01T00:00:00Z' },
      [userB]: { email: 'unverified@example.invalid', emailConfirmedAt: null },
    },
  );

  const page = await buildLegacyMemberMigrationPage({
    afterGrantId: null,
    limit: 10,
    mode: 'dry_run',
    store,
  });

  assert.deepEqual(page.members, [
    { walkingpovUserId: userA, legacyGrantVersion: 5, emailStatus: 'verified' },
    { walkingpovUserId: userB, legacyGrantVersion: 1, emailStatus: 'unverified' },
  ]);
  assert.equal(page.scannedGrantCount, 3);
  assert.equal(page.nextCursor, null);
  assert.equal(JSON.stringify(page).includes('@example.invalid'), false);
});

test('apply pages include only a currently confirmed source email', async () => {
  const store = makeStore(
    [
      { id: grantA1, userId: userA },
      { id: grantB1, userId: userB },
    ],
    [
      { id: grantA1, userId: userA, state: 'active', version: 1 },
      { id: grantB1, userId: userB, state: 'active', version: 1 },
    ],
    {
      [userA]: { email: 'Member@Example.invalid ', emailConfirmedAt: '2026-01-01T00:00:00Z' },
      [userB]: { email: 'unverified@example.invalid', emailConfirmedAt: null },
    },
  );

  const page = await buildLegacyMemberMigrationPage({
    afterGrantId: null,
    limit: 10,
    mode: 'apply',
    store,
  });

  assert.deepEqual(page.members, [
    { walkingpovUserId: userA, legacyGrantVersion: 1, emailStatus: 'verified', email: 'member@example.invalid' },
    { walkingpovUserId: userB, legacyGrantVersion: 1, emailStatus: 'unverified' },
  ]);
});

test('cursor advances by grant primary key and progress remains deterministic', async () => {
  const rows = [
    { id: grantA1, userId: userA },
    { id: grantA2, userId: userA },
    { id: grantB1, userId: userB },
  ];
  const store = makeStore(
    rows,
    rows.map((grant) => ({ ...grant, state: 'active' as const, version: 1 })),
    {
      [userA]: { email: 'member-a@example.invalid', emailConfirmedAt: '2026-01-01T00:00:00Z' },
      [userB]: { email: 'member-b@example.invalid', emailConfirmedAt: '2026-01-01T00:00:00Z' },
    },
  );

  const first = await buildLegacyMemberMigrationPage({ afterGrantId: null, limit: 2, mode: 'dry_run', store });
  const second = await buildLegacyMemberMigrationPage({ afterGrantId: first.nextCursor, limit: 2, mode: 'dry_run', store });

  assert.equal(first.nextCursor, grantA2);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(first.members.map((member) => member.walkingpovUserId), [userA]);
  assert.deepEqual(second.members.map((member) => member.walkingpovUserId), [userB]);
});

test('rejects invalid grant versions and page sizes rather than guessing entitlement', async () => {
  const invalidStore = makeStore(
    [{ id: grantA1, userId: userA }],
    [{ id: grantA1, userId: userA, state: 'active', version: 0 }],
    { [userA]: { email: 'member@example.invalid', emailConfirmedAt: '2026-01-01T00:00:00Z' } },
  );

  await assert.rejects(
    buildLegacyMemberMigrationPage({ afterGrantId: null, limit: 10, mode: 'dry_run', store: invalidStore }),
    /invalid grant version/,
  );
  await assert.rejects(
    buildLegacyMemberMigrationPage({ afterGrantId: null, limit: 51, mode: 'dry_run', store: invalidStore }),
    /page limit is invalid/,
  );
});
