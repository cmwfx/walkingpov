const MAX_GRANT_VERSION = 2_147_483_647n;

export type LegacyMigrationGrant = {
  id: string;
  userId: string;
  state: "active" | "suspended" | "revoked";
  version: number | string;
};

export type LegacyMigrationSourceUser = {
  email: string | null;
  emailConfirmedAt: string | null;
} | null;

export type LegacyMigrationStore = {
  readActiveGrantPage(input: {
    afterGrantId: string | null;
    limit: number;
  }): Promise<Array<Pick<LegacyMigrationGrant, "id" | "userId">>>;
  readGrantRowsForUsers(userIds: string[]): Promise<LegacyMigrationGrant[]>;
  readSourceUser(userId: string): Promise<LegacyMigrationSourceUser>;
};

export type LegacyMigrationMember = {
  walkingpovUserId: string;
  legacyGrantVersion: number;
  emailStatus: "verified" | "unverified" | "missing";
  email?: string;
};

export async function buildLegacyMemberMigrationPage(input: {
  afterGrantId: string | null;
  limit: number;
  mode: "dry_run" | "apply";
  store: LegacyMigrationStore;
}) {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new Error("Migration page limit is invalid.");
  }

  const grantPage = await input.store.readActiveGrantPage({
    afterGrantId: input.afterGrantId,
    limit: input.limit + 1,
  });
  const hasMore = grantPage.length > input.limit;
  const selectedGrantRows = grantPage.slice(0, input.limit);
  const afterGrantId = hasMore ? (selectedGrantRows.at(-1)?.id ?? null) : null;
  const candidateIds = [...new Set(selectedGrantRows.map((grant) => grant.userId))];
  const grantRows = candidateIds.length
    ? await input.store.readGrantRowsForUsers(candidateIds)
    : [];
  const byUser = new Map<string, LegacyMigrationGrant[]>();

  for (const grant of grantRows) {
    if (!candidateIds.includes(grant.userId)) throw new Error("Migration source returned an unexpected account.");
    const current = byUser.get(grant.userId) ?? [];
    current.push(grant);
    byUser.set(grant.userId, current);
  }

  const eligible = [...byUser.entries()]
    .map(([walkingpovUserId, grants]) => {
      let revision = 0n;
      let active = false;
      for (const grant of grants) {
        if (!Number.isSafeInteger(Number(grant.version)) || BigInt(grant.version) <= 0n) {
          throw new Error("Migration source contains an invalid grant version.");
        }
        revision += BigInt(grant.version);
        if (grant.state === "active") active = true;
      }
      if (revision > MAX_GRANT_VERSION) throw new Error("Migration grant version exceeds the supported range.");
      return active
        ? { walkingpovUserId, legacyGrantVersion: Number(revision) }
        : null;
    })
    .filter((member): member is { walkingpovUserId: string; legacyGrantVersion: number } => member !== null)
    .sort((left, right) => left.walkingpovUserId.localeCompare(right.walkingpovUserId));

  const sourceUsers = await mapWithConcurrency(eligible, 5, (member) =>
    input.store.readSourceUser(member.walkingpovUserId),
  );
  const members: LegacyMigrationMember[] = eligible.map((member, index) => {
    const sourceUser = sourceUsers[index];
    const email = sourceUser?.email?.trim() || null;
    const emailStatus = !email
      ? "missing"
      : sourceUser?.emailConfirmedAt
        ? "verified"
        : "unverified";
    return {
      ...member,
      emailStatus,
      ...(input.mode === "apply" && emailStatus === "verified" && email
        ? { email: email.toLowerCase() }
        : {}),
    };
  });

  return {
    members,
    scannedGrantCount: selectedGrantRows.length,
    nextCursor: afterGrantId,
  };
}

async function mapWithConcurrency<T, Result>(
  values: T[],
  concurrency: number,
  map: (value: T) => Promise<Result>,
) {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await map(values[currentIndex]!);
    }
  });
  await Promise.all(workers);
  return results;
}
