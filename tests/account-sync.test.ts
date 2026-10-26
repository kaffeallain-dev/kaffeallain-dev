/**
 * Comprehensive Account Isolation, Outbox Ordering & Sync Lifecycle Regression Test Suite
 *
 * Runs with Node test runner against actual IndexedDB (via fake-indexeddb) and production
 * SyncController and db implementations.
 */

import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import * as db from '../src/lib/db';
import { SyncController } from '../src/lib/syncController';
import { 
  toOwnerKey, 
  toOwnerIdentity, 
  encodeUidInjective, 
  getOwnerOnboardingKey 
} from '../src/lib/ownerIdentity';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../src/types';

// =========================================================================
// 1. Injective UID Collisions & Namespace Integrity
// =========================================================================
test('1a. Injective UID namespace prevents collisions between "a.b" and "a_b"', () => {
  const keyDot = toOwnerKey({ kind: 'user', uid: 'a.b' });
  const keyUnder = toOwnerKey({ kind: 'user', uid: 'a_b' });

  assert.notEqual(keyDot, keyUnder, 'Keys for "a.b" and "a_b" must be strictly distinct');
  assert.equal(keyDot, 'u_' + encodeUidInjective('a.b'));
  assert.equal(keyUnder, 'u_' + encodeUidInjective('a_b'));

  const dbDot = db.getDBNameForOwner({ kind: 'user', uid: 'a.b' });
  const dbUnder = db.getDBNameForOwner({ kind: 'user', uid: 'a_b' });
  assert.notEqual(dbDot, dbUnder, 'Physical database names must be strictly distinct');
});

test('1b. Explicit guest discriminator prevents collision between user "guest" and guest session', () => {
  const guestKey = toOwnerKey({ kind: 'guest' });
  const userGuestKey = toOwnerKey({ kind: 'user', uid: 'guest' });

  assert.equal(guestKey, 'g_guest', 'Guest session key must have explicit guest discriminator');
  assert.equal(userGuestKey, 'u_' + encodeUidInjective('guest'), 'User whose UID is "guest" must have user prefix');
  assert.notEqual(guestKey, userGuestKey, 'Guest session and user "guest" must NEVER collide');

  const dbGuest = db.getDBNameForOwner({ kind: 'guest' });
  const dbUserGuest = db.getDBNameForOwner({ kind: 'user', uid: 'guest' });
  assert.notEqual(dbGuest, dbUserGuest, 'Database handles must be strictly distinct');
});

test('1c. Non-destructive migration preserves historical stores without deleting historical databases', async () => {
  // Simulate an existing historical store from earlier regex version
  const oldStoreName = 'mboafit_store_test_mig_user';
  const oldDb = await db.getDB(null); // opens guest initially
  // Create old store structure directly
  const historicalDB = await (await import('idb')).openDB<db.ScopedMboaFitDB>(oldStoreName, 1, {
    upgrade(d) {
      d.createObjectStore('consumptions', { keyPath: 'id' });
      d.createObjectStore('customFoods', { keyPath: 'id' });
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('pendingWrites', { keyPath: 'id' });
    }
  });

  const historicalMeal: ConsumptionRecord = {
    id: 'hist_meal_1',
    name: 'Historical Ndole',
    calories: 450,
    protein: 25,
    carbs: 20,
    fat: 30,
    servings: 1,
    mealCategory: 'Dinner',
    timestamp: 1600000000000
  };
  await historicalDB.put('consumptions', historicalMeal);
  await historicalDB.put('settings', { id: 'test_mig_user', dailyGoal: 2000, verifiedOwnerUid: 'test_mig_user' });
  historicalDB.close();

  // Opening via new injective UID "test_mig_user" should migrate historical data non-destructively
  const targetIdentity = { kind: 'user' as const, uid: 'test_mig_user' };
  const targetDB = await db.getDB(targetIdentity);
  const targetMeals = await targetDB.getAll('consumptions');

  assert.equal(targetMeals.length, 1, 'Historical meal was migrated into new injective database');
  assert.equal(targetMeals[0].name, 'Historical Ndole');

  // Verify historical store still exists intact
  const recheckHistoricalDB = await (await import('idb')).openDB(oldStoreName, 1);
  const oldMeals = await recheckHistoricalDB.getAll('consumptions');
  assert.equal(oldMeals.length, 1, 'Historical database was preserved untouched and NOT deleted');
  recheckHistoricalDB.close();
});

// =========================================================================
// 2. Coalesced Outbox Ordering & No Deleted Meal Resurrection
// =========================================================================
test('2. Offline create -> update -> delete coalesces outbox and never resurrects deleted meal', async () => {
  const owner = { kind: 'user' as const, uid: 'user_outbox_order' };
  await db.clearPendingWrites(owner);
  await db.clearAllConsumptions(owner);

  const meal: ConsumptionRecord = {
    id: 'meal_lifecycle_99',
    name: 'Offline Meal Created',
    calories: 300,
    protein: 10,
    carbs: 40,
    fat: 5,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };

  // 1. Create offline
  const item1 = await db.saveConsumptionAtomic(owner, meal);
  assert.equal(item1.revision, 1);
  assert.equal(item1.operation, 'saveConsumption');

  // 2. Update offline
  const updatedMeal: ConsumptionRecord = { ...meal, name: 'Offline Meal Updated', calories: 350 };
  const item2 = await db.saveConsumptionAtomic(owner, updatedMeal);
  assert.equal(item2.revision, 2);
  assert.equal(item2.operation, 'saveConsumption');

  // 3. Delete offline
  const item3 = await db.deleteConsumptionAtomic(owner, meal.id);
  assert.equal(item3.revision, 3);
  assert.equal(item3.operation, 'deleteConsumption');

  // Inspect outbox in IndexedDB
  const pending = await db.getPendingWrites(owner);
  assert.equal(pending.length, 1, 'Outbox must contain exactly ONE coalesced entry for this entity');
  assert.equal(pending[0].id, `meal:${meal.id}`);
  assert.equal(pending[0].operation, 'deleteConsumption', 'Coalesced outbox operation must be DELETE, not CREATE/UPDATE');
  assert.equal(pending[0].revision, 3);

  // Local store has 0 meals
  const localMeals = await db.getAllConsumptions(owner);
  assert.equal(localMeals.length, 0, 'Local consumptions store has 0 meals (deletion persisted)');
});

// =========================================================================
// 3. Concurrent Newer Edit Survives Acknowledgment
// =========================================================================
test('3. In-flight write acknowledgment only acknowledges matching revision, preserving newer edit', async () => {
  const owner = { kind: 'user' as const, uid: 'user_concurrent_edit' };
  await db.clearPendingWrites(owner);

  const initialMeal: ConsumptionRecord = {
    id: 'meal_race_1',
    name: 'Version 1',
    calories: 200,
    protein: 5,
    carbs: 30,
    fat: 2,
    servings: 1,
    mealCategory: 'Breakfast',
    timestamp: 1700000000000
  };

  // Step 1: Save version 1 (Revision 1)
  const write1 = await db.saveConsumptionAtomic(owner, initialMeal);
  assert.equal(write1.revision, 1);

  // Step 2: In-flight send captured revision 1
  const capturedRevisionInFlight = write1.revision;

  // Step 3: Concurrent user edit happens before server response returns!
  const newerMeal: ConsumptionRecord = { ...initialMeal, name: 'Version 2 (Newer)', calories: 250 };
  const write2 = await db.saveConsumptionAtomic(owner, newerMeal);
  assert.equal(write2.revision, 2, 'Newer edit incremented revision to 2');

  // Step 4: Server response for Version 1 returns with success!
  // Acknowledge revision 1
  const acknowledged = await db.acknowledgePendingWrite(owner, write1.id, capturedRevisionInFlight);
  assert.equal(acknowledged, false, 'Acknowledgment for revision 1 must return false because store has newer revision 2');

  // Verify that the outbox STILL has Version 2!
  const pending = await db.getPendingWrites(owner);
  assert.equal(pending.length, 1, 'Pending writes outbox still holds the newer edit');
  assert.equal(pending[0].revision, 2);
  assert.equal(pending[0].payload.name, 'Version 2 (Newer)');

  // Step 5: When Version 2 ack arrives:
  const ack2 = await db.acknowledgePendingWrite(owner, write1.id, 2);
  assert.equal(ack2, true, 'Acknowledgment for revision 2 succeeds');
  const pendingAfterAck2 = await db.getPendingWrites(owner);
  assert.equal(pendingAfterAck2.length, 0, 'Queue is cleanly drained after exact revision match');
});

// =========================================================================
// 4. Pending Settings vs Old Remote Snapshot
// =========================================================================
test('4. Hydration preserves pending local settings and does NOT overwrite them with stale remote snapshot', async () => {
  const owner = { kind: 'user' as const, uid: 'user_pending_settings' };
  await db.clearPendingWrites(owner);

  // User saved 2600 kcal while offline
  const offlineSettings: UserSettings = {
    id: toOwnerKey(owner),
    dailyGoal: 2600,
    onboardingCompleted: true,
    profile: { primaryGoal: 'Build Muscle', weightKg: 80 }
  };
  await db.saveSettingsAtomic(owner, offlineSettings);

  // Stale cloud snapshot has 1800 kcal
  const staleCloudSettings: UserSettings = {
    id: owner.uid,
    dailyGoal: 1800,
    onboardingCompleted: true,
    profile: { primaryGoal: 'Lose Weight', weightKg: 75 }
  };

  const mockFirestore = {
    getUserSettings: async () => staleCloudSettings,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [],
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  await controller.refresh();

  const activeSettings = controller.getState().settings;
  assert.equal(activeSettings.dailyGoal, 2600, 'Pending local settings (2600 kcal) took precedence over stale cloud snapshot (1800 kcal)');
  assert.equal(activeSettings.profile?.primaryGoal, 'Build Muscle');
});

// =========================================================================
// 5. Concurrent Hydration & Mutation
// =========================================================================
test('5. Concurrent local mutation during hydration is preserved and not clobbered by remote load', async () => {
  const owner = { kind: 'user' as const, uid: 'user_concurrent_hydrate' };
  await db.clearAllConsumptions(owner);
  await db.clearPendingWrites(owner);

  const cloudMeal: ConsumptionRecord = {
    id: 'cloud_m1',
    name: 'Cloud Meal',
    calories: 400,
    protein: 20,
    carbs: 40,
    fat: 10,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };

  let resolveCloudConsumptions: (v: ConsumptionRecord[]) => void;
  const cloudConsumptionsPromise = new Promise<ConsumptionRecord[]>((resolve) => {
    resolveCloudConsumptions = resolve;
  });

  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: () => cloudConsumptionsPromise,
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // Start hydration in background
  const hydratePromise = controller.refresh();

  // While hydration is in-flight awaiting network, user adds a new local meal!
  const localMeal: ConsumptionRecord = {
    id: 'local_concurrent_1',
    name: 'Local Fresh Meal',
    calories: 220,
    protein: 5,
    carbs: 35,
    fat: 2,
    servings: 1,
    mealCategory: 'Snacks',
    timestamp: 1700000050000
  };
  await controller.addConsumption(localMeal);

  // Now cloud response arrives
  resolveCloudConsumptions!([cloudMeal]);
  await hydratePromise;

  // Verify that the local meal was NOT dropped or overwritten!
  const allConsumptions = controller.getState().allConsumptions;
  assert(allConsumptions.some(m => m.id === 'local_concurrent_1'), 'Local meal added during hydration was preserved');
});

// =========================================================================
// 6. Failed Retry Never Reports Synced
// =========================================================================
test('6. Failed outbox retry never reports synced and surfaces syncError', async () => {
  const owner = { kind: 'user' as const, uid: 'user_failed_retry' };
  await db.clearPendingWrites(owner);

  const meal: ConsumptionRecord = {
    id: 'meal_fail_1',
    name: 'Failing Meal',
    calories: 100,
    protein: 2,
    carbs: 10,
    fat: 1,
    servings: 1,
    mealCategory: 'Snacks',
    timestamp: 1700000000000
  };

  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [],
    saveConsumption: async () => {
      throw new Error('Network timeout contacting cloud');
    },
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // Adding consumption fails on cloud
  await controller.addConsumption(meal);

  const state = controller.getState();
  assert.notEqual(state.syncStatus, 'synced', 'Status must NOT be synced after cloud failure');
  assert.equal(state.syncStatus, 'error', 'Status must be "error"');
  assert(state.syncError !== null, 'syncError must be surfaced');

  // Verify pending write remains in queue
  const pending = await db.getPendingWrites(owner);
  assert.equal(pending.length, 1, 'Write remains safely in durable queue');
});

// =========================================================================
// 7. Identity Switch: A -> B Delayed Load & Failing Save Cannot Mutate B
// =========================================================================
test('7. Delayed load or failing save from User A cannot mutate User B state or status', async () => {
  const userA = { kind: 'user' as const, uid: 'user_A_late' };
  const userB = { kind: 'user' as const, uid: 'user_B_target' };

  let delayedResolveA: (v: ConsumptionRecord[]) => void;
  const delayedPromiseA = new Promise<ConsumptionRecord[]>((resolve) => {
    delayedResolveA = resolve;
  });

  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async (uid: string) => {
      if (uid === userA.uid) {
        return delayedPromiseA;
      }
      return [];
    },
    saveConsumption: async (uid: string) => {
      if (uid === userA.uid) {
        await new Promise(r => setTimeout(r, 60));
        throw new Error('User A late network failure');
      }
    },
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(userA, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // Start load for A
  const loadPromiseA = controller.refresh();

  // Start failing async save for A
  const savePromiseA = controller.addConsumption({
    id: 'meal_late_A',
    name: 'Late Meal A',
    calories: 500,
    protein: 20,
    carbs: 50,
    fat: 10,
    servings: 1,
    mealCategory: 'Dinner',
    timestamp: 1700000000000
  });

  // User immediately switches to User B!
  controller.switchOwner(userB, true);
  assert.equal(controller.getState().allConsumptions.length, 0, 'User B state is immediately blank');
  assert.equal(controller.getOwnerKey(), toOwnerKey(userB));

  // Now let User A's delayed load resolve
  delayedResolveA!([{
    id: 'stale_A_fetched',
    name: 'Stale A Fetched Meal',
    calories: 600,
    protein: 30,
    carbs: 60,
    fat: 20,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  }]);

  await loadPromiseA;
  await savePromiseA;

  // Verify User B's state was NOT contaminated by User A's resolved load or error!
  const stateB = controller.getState();
  assert.equal(stateB.allConsumptions.length, 0, 'User B received ZERO items from User A');
  assert.equal(stateB.syncError, null, 'User B did NOT receive User A save error');
});

// =========================================================================
// 8. Same-Owner Overlapping Loads Guard
// =========================================================================
test('8. Slower load for same owner is discarded when newer load supersedes it', async () => {
  const owner = { kind: 'user' as const, uid: 'user_same_owner_race' };
  let resolveSlowLoad: (v: ConsumptionRecord[]) => void;
  const slowPromise = new Promise<ConsumptionRecord[]>((resolve) => {
    resolveSlowLoad = resolve;
  });

  let p1ReachedConsumption!: () => void;
  const p1ReachedPromise = new Promise<void>((r) => { p1ReachedConsumption = r; });

  let loadCallCount = 0;
  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => {
      loadCallCount++;
      if (loadCallCount === 1) {
        p1ReachedConsumption();
        return slowPromise; // First load is slow
      }
      // Second load finishes immediately with newer data
      return [{
        id: 'newer_meal_2',
        name: 'Newer Fast Meal',
        calories: 300,
        protein: 15,
        carbs: 30,
        fat: 5,
        servings: 1,
        mealCategory: 'Lunch',
        timestamp: 1700000000000
      }];
    },
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // Launch load 1 (slow)
  const p1 = controller.refresh();

  // Wait until p1 is actually in-flight awaiting slowPromise in getUserConsumptions
  await p1ReachedPromise;

  // Launch load 2 (fast)
  const p2 = controller.refresh();
  await p2;

  assert.equal(controller.getState().allConsumptions.length, 1);
  assert.equal(controller.getState().allConsumptions[0].name, 'Newer Fast Meal');

  // Now resolve load 1 with stale data
  resolveSlowLoad!([{
    id: 'stale_slow_1',
    name: 'Stale Slow Meal',
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
    servings: 1,
    mealCategory: 'Breakfast',
    timestamp: 1600000000000
  }]);
  await p1;

  // Ensure newer data was NOT replaced by slower, older load 1!
  assert.equal(controller.getState().allConsumptions.length, 1);
  assert.equal(controller.getState().allConsumptions[0].name, 'Newer Fast Meal', 'Newer load result took precedence over older slower load');
});

// =========================================================================
// 9. Explicit Guest Import Retry Preservation & Target Protection
// =========================================================================
test('9. Explicit guest import preserves existing cloud targets, guest originals, and supports retry', async () => {
  const guestIdentity = { kind: 'guest' as const };
  const userTarget = { kind: 'user' as const, uid: 'user_target_import' };

  await db.clearAllConsumptions(guestIdentity);
  await db.clearAllConsumptions(userTarget);

  // Guest has 2 meals: "Plantain" and "Corn"
  const guestMeal1: ConsumptionRecord = {
    id: 'guest_m1',
    name: 'Plantain',
    calories: 200,
    protein: 2,
    carbs: 45,
    fat: 1,
    servings: 1,
    mealCategory: 'Snacks',
    timestamp: 1700000000000
  };
  const guestMeal2: ConsumptionRecord = {
    id: 'guest_m2',
    name: 'Corn',
    calories: 150,
    protein: 4,
    carbs: 30,
    fat: 2,
    servings: 1,
    mealCategory: 'Snacks',
    timestamp: 1700000010000
  };
  await db.addConsumption(guestIdentity, guestMeal1);
  await db.addConsumption(guestIdentity, guestMeal2);

  // User Target already has "Plantain" in cloud
  const targetCloudMeals: ConsumptionRecord[] = [guestMeal1];
  const targetCloudSettings: UserSettings = {
    id: userTarget.uid,
    dailyGoal: 2500,
    onboardingCompleted: true,
    profile: { primaryGoal: 'Build Muscle', weightKg: 85 }
  };

  let importedCalls: any[] = [];
  const mockFirestore = {
    getUserSettings: async () => targetCloudSettings,
    saveUserSettings: async () => {
      throw new Error('Should NOT overwrite cloud settings!');
    },
    getUserConsumptions: async () => targetCloudMeals,
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async (uid: string, s: any, meals: any[], foods: any[], preserve: boolean) => {
      importedCalls.push({ uid, meals, preserve });
      return { importedMeals: meals.length, importedCustomFoods: 0 };
    }
  };

  const controller = new SyncController(userTarget, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  const res = await controller.importGuestData();
  assert.equal(res.importedMeals, 1, 'Only novel "Corn" was imported; duplicate "Plantain" was skipped');

  // Verify guest originals were preserved untouched!
  const guestStoreAfter = await db.getAllConsumptions(guestIdentity);
  assert.equal(guestStoreAfter.length, 2, 'Guest store retains both original meals untouched');

  // Verify target settings untouched
  assert.equal(targetCloudSettings.dailyGoal, 2500);

  // Partial retry test: running importGuestData again should import 0 items (idempotent)
  targetCloudMeals.push(guestMeal2); // now corn is also on cloud
  const retryRes = await controller.importGuestData();
  assert.equal(retryRes.importedMeals, 0, 'Retry is strictly idempotent and imported 0 duplicates');
});

// =========================================================================
// 10. Strict Owner Storage Migration Quarantine
// =========================================================================
test('10. Migration quarantine protects guest store from user "guest", rejects lossy regex collisions, and is idempotent after deletions', async () => {
  // Setup: Put distinctive meal in guest store
  const guestIdentity = { kind: 'guest' as const };
  const guestDb = await db.getDB(guestIdentity);
  await guestDb.put('consumptions', {
    id: 'guest_distinct_1',
    name: 'Guest Secret Food',
    calories: 250,
    protein: 10,
    carbs: 30,
    fat: 5,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  });

  // Test 10a: User whose UID is "guest" must NEVER auto-import mboafit_store_guest!
  const userGuestIdentity = { kind: 'user' as const, uid: 'guest' };
  const userGuestDb = await db.getDB(userGuestIdentity);
  const userGuestMeals = await userGuestDb.getAll('consumptions');
  assert.equal(userGuestMeals.length, 0, 'User whose UID is "guest" must NOT auto-import the guest session data');

  // Test 10b: Any legacy store created by non-injective mapping has ambiguous provenance.
  // Both "a.b" AND "a_b" must NOT auto-import "mboafit_store_a_b" without an independently verified owner marker!
  const fakeOldDb = await (await import('idb')).openDB<db.ScopedMboaFitDB>('mboafit_store_a_b', 1, {
    upgrade(d) {
      d.createObjectStore('consumptions', { keyPath: 'id' });
      d.createObjectStore('customFoods', { keyPath: 'id' });
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('pendingWrites', { keyPath: 'id' });
    }
  });
  await fakeOldDb.put('consumptions', {
    id: 'ab_meal',
    name: 'Ambiguous Food',
    calories: 300,
    protein: 10,
    carbs: 40,
    fat: 5,
    servings: 1,
    mealCategory: 'Dinner',
    timestamp: 1700000000000
  });
  fakeOldDb.close();

  // Test a.b against mboafit_store_a_b
  const userDotIdentity = { kind: 'user' as const, uid: 'a.b' };
  const userDotDb = await db.getDB(userDotIdentity);
  const userDotMeals = await userDotDb.getAll('consumptions');
  assert.equal(userDotMeals.length, 0, 'User "a.b" must NOT auto-import ambiguous "a_b" store');

  // Test a_b against mboafit_store_a_b
  const userUnderIdentity = { kind: 'user' as const, uid: 'a_b' };
  const userUnderDb = await db.getDB(userUnderIdentity);
  const userUnderMeals = await userUnderDb.getAll('consumptions');
  assert.equal(userUnderMeals.length, 0, 'User "a_b" must NOT auto-import ambiguous legacy "a_b" store without verified marker');

  // Test guest session against mboafit_store_a_b
  const guestDbCheck = await db.getDB({ kind: 'guest' });
  const guestMealsCheck = await guestDbCheck.getAll('consumptions');
  assert.equal(guestMealsCheck.some(m => m.id === 'ab_meal'), false, 'Guest session does not import legacy store');

  // Verify the legacy store remains completely intact and untouched!
  const legacyRecheck = await (await import('idb')).openDB('mboafit_store_a_b', 1);
  const legacyMeals = await legacyRecheck.getAll('consumptions');
  assert.equal(legacyMeals.length, 1, 'Legacy store remains intact and untouched');
  legacyRecheck.close();

  // Test 10c: Deleting all meals (consumptions count === 0) does not resurrect records
  const normalUser = { kind: 'user' as const, uid: 'user_delete_no_resurrect' };
  const normalOldDb = await (await import('idb')).openDB<db.ScopedMboaFitDB>('mboafit_store_user_delete_no_resurrect', 1, {
    upgrade(d) {
      d.createObjectStore('consumptions', { keyPath: 'id' });
      d.createObjectStore('customFoods', { keyPath: 'id' });
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('pendingWrites', { keyPath: 'id' });
    }
  });
  await normalOldDb.put('consumptions', {
    id: 'normal_m1',
    name: 'Old Meal 1',
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
    servings: 1,
    mealCategory: 'Breakfast',
    timestamp: 1700000000000
  });
  await normalOldDb.put('settings', { id: 'user_delete_no_resurrect', dailyGoal: 2000, verifiedOwnerUid: 'user_delete_no_resurrect' });
  normalOldDb.close();

  // First open: migrates 1 record
  const userDb1 = await db.getDB(normalUser);
  const meals1 = await userDb1.getAll('consumptions');
  assert.equal(meals1.length, 1);

  // User deletes all records
  await userDb1.clear('consumptions');
  assert.equal((await userDb1.getAll('consumptions')).length, 0);

  // Re-opening the DB handle must NOT re-run migration and resurrect the deleted meal!
  const userDb2 = await db.getDB(normalUser);
  const meals2 = await userDb2.getAll('consumptions');
  assert.equal(meals2.length, 0, 'Deleted meals are NOT resurrected when consumptions count becomes 0');
});

// =========================================================================
// 11. Serialized Remote Drain & ABA Prevention
// =========================================================================
test('11. Serialized writes drain in order, preventing remote create/delete resurrection and ABA tokens', async () => {
  const owner = { kind: 'user' as const, uid: 'user_serialized_drain' };
  await db.clearPendingWrites(owner);
  await db.clearAllConsumptions(owner);

  const remoteLog: { action: string; id: string }[] = [];
  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [],
    saveConsumption: async (uid: string, r: any) => {
      // Simulate small async delay
      await new Promise(r => setTimeout(r, 5));
      remoteLog.push({ action: 'save', id: r.id });
    },
    deleteConsumption: async (uid: string, id: string) => {
      await new Promise(r => setTimeout(r, 5));
      remoteLog.push({ action: 'delete', id });
    },
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  const meal: ConsumptionRecord = {
    id: 'meal_rapid_lifecycle',
    name: 'Rapid Meal',
    calories: 400,
    protein: 20,
    carbs: 40,
    fat: 10,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };

  // User adds meal, then immediately updates it, then deletes it
  await controller.addConsumption(meal);
  await controller.updateConsumption({ ...meal, calories: 450 });
  await controller.deleteConsumption(meal.id);

  // Wait for serialized drain to finish
  await controller.drainPendingWrites();

  // Inspect remote call sequence:
  // With outbox coalescing & serialized drain, the final operation executed on remote must be delete!
  const lastAction = remoteLog[remoteLog.length - 1];
  assert.equal(lastAction.action, 'delete', 'Final action on remote server must be DELETE, never save/resurrection');
  assert.equal(lastAction.id, meal.id);

  // Verify status is synced with empty queue
  assert.equal(controller.getState().syncStatus, 'synced');
  assert.equal((await db.getPendingWrites(owner)).length, 0);

  // ABA Prevention Check:
  // Recreating the same meal ID after acknowledgement must generate a strictly HIGHER revision token!
  const recreatedMeal = await db.saveConsumptionAtomic(owner, meal);
  assert.ok(recreatedMeal.revision > 3, `Recreated meal revision (${recreatedMeal.revision}) must be strictly higher than prior revisions (no ABA)`);
});

// =========================================================================
// 12. Hydration Safety: No Remote Deletion Resurrection
// =========================================================================
test('12. Hydration does NOT resurrect remote deletions while preserving concurrent local mutations', async () => {
  const owner = { kind: 'user' as const, uid: 'user_hydration_safe' };
  await db.clearAllConsumptions(owner);
  await db.clearPendingWrites(owner);

  // Local DB has old meal 'm_old' from prior session
  const oldLocalMeal: ConsumptionRecord = {
    id: 'm_old',
    name: 'Old Meal (Deleted Remotely)',
    calories: 300,
    protein: 10,
    carbs: 30,
    fat: 5,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1690000000000
  };
  await db.addConsumption(owner, oldLocalMeal);

  // Cloud snapshot only has 'm_cloud_active' (m_old was deleted remotely!)
  const cloudActiveMeal: ConsumptionRecord = {
    id: 'm_cloud_active',
    name: 'Active Cloud Meal',
    calories: 500,
    protein: 25,
    carbs: 60,
    fat: 15,
    servings: 1,
    mealCategory: 'Dinner',
    timestamp: 1700000000000
  };

  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [cloudActiveMeal],
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  await controller.refresh();

  const activeConsumptions = controller.getState().allConsumptions;
  assert.equal(activeConsumptions.length, 1);
  assert.equal(activeConsumptions[0].id, 'm_cloud_active');

  // Verify m_old was NOT resurrected in local IndexedDB!
  const localDbMeals = await db.getAllConsumptions(owner);
  assert.equal(localDbMeals.length, 1);
  assert.equal(localDbMeals[0].id, 'm_cloud_active', 'Old remotely-deleted meal was not resurrected');
});

// =========================================================================
// 13. Reconnection Drain & Strict Sync Status + Retry
// =========================================================================
test('13. Reconnection drains pending writes and updates syncStatus to synced; retrySync re-attempts on failure', async () => {
  const owner = { kind: 'user' as const, uid: 'user_reconnect_retry' };
  await db.clearAllConsumptions(owner);
  await db.clearPendingWrites(owner);

  let shouldFailCloud = true;
  const uploadedMeals: string[] = [];

  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [],
    saveConsumption: async (uid: string, r: any) => {
      if (shouldFailCloud) {
        throw new Error('Cloud offline timeout');
      }
      uploadedMeals.push(r.id);
    },
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  // Start offline
  const controller = new SyncController(owner, false, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  await controller.addConsumption({
    id: 'offline_meal_1',
    name: 'Offline Meal',
    calories: 250,
    protein: 10,
    carbs: 30,
    fat: 5,
    servings: 1,
    mealCategory: 'Breakfast',
    timestamp: 1700000000000
  });

  assert.equal(controller.getState().syncStatus, 'offline');

  // Reconnect when cloud is failing: status becomes 'error'
  controller.setOnline(true);
  await controller.drainPendingWrites();
  assert.equal(controller.getState().syncStatus, 'error');
  assert.ok(controller.getState().syncError?.includes('Cloud offline timeout'));

  // Cloud is restored! User triggers retrySync
  shouldFailCloud = false;
  await controller.retrySync();

  assert.equal(controller.getState().syncStatus, 'synced');
  assert.equal(controller.getState().syncError, null);
  assert.equal(uploadedMeals.length, 1);
  assert.equal(uploadedMeals[0], 'offline_meal_1');
  assert.equal((await db.getPendingWrites(owner)).length, 0);
});

// =========================================================================
// 14. Owner-Keyed Drain Chains: Unresolved A Does Not Block B
// =========================================================================
test('14. Owner-keyed drain chains: User B remote write completes promptly while User A is deliberately unresolved', async () => {
  const userA = { kind: 'user' as const, uid: 'user_hung_A' };
  const userB = { kind: 'user' as const, uid: 'user_independent_B' };

  let unresolvedPromiseA = new Promise<void>(() => {}); // Never resolves

  const writesLogged: string[] = [];
  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [],
    saveConsumption: async (uid: string, r: any) => {
      if (uid === userA.uid) {
        return unresolvedPromiseA;
      }
      writesLogged.push(`${uid}:${r.id}`);
    },
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controllerA = new SyncController(userA, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  const controllerB = new SyncController(userB, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // User A starts mutation whose remote write hangs indefinitely:
  controllerA.addConsumption({
    id: 'meal_hung_A',
    name: 'Hung Meal A',
    calories: 100,
    protein: 1,
    carbs: 1,
    fat: 1,
    servings: 1,
    mealCategory: 'Snacks',
    timestamp: 1700000000000
  });

  // User B immediately performs an independent mutation:
  const bCompleted = await Promise.race([
    controllerB.addConsumption({
      id: 'meal_fast_B',
      name: 'Fast Meal B',
      calories: 200,
      protein: 5,
      carbs: 10,
      fat: 2,
      servings: 1,
      mealCategory: 'Lunch',
      timestamp: 1700000000000
    }).then(() => true),
    new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('User B was blocked by hung User A!')), 1000))
  ]);

  assert.equal(bCompleted, true, 'User B completed remote write independently without being blocked by User A');
  assert.equal(controllerB.getState().syncStatus, 'synced');
  assert.ok(writesLogged.includes('user_independent_B:meal_fast_B'));
});

// =========================================================================
// 15. Acknowledged Deletion & Settings During Hydration Resurrection Prevention
// =========================================================================
test('15. Acknowledged deletion during hydration does NOT resurrect meal, custom food, or overwrite updated settings', async () => {
  const owner = { kind: 'user' as const, uid: 'user_hydrate_del_ack' };
  await db.clearAllConsumptions(owner);
  await db.clearPendingWrites(owner);

  const staleCloudMeal: ConsumptionRecord = {
    id: 'meal_resurrect_target',
    name: 'Meal To Delete',
    calories: 500,
    protein: 20,
    carbs: 40,
    fat: 10,
    servings: 1,
    mealCategory: 'Dinner',
    timestamp: 1700000000000
  };

  const staleCloudCustom: CustomFoodTemplate = {
    id: 'custom_resurrect_target',
    name: 'Custom To Delete',
    calories: 250,
    protein: 10,
    carbs: 25,
    fat: 5,
    servingSizeText: '1 bowl',
    isCustom: true,
    createdAt: Date.now()
  };

  const staleCloudSettings: UserSettings = {
    id: owner.uid,
    dailyGoal: 2000,
    onboardingCompleted: true
  };

  let resolveCloudConsumptions!: (v: ConsumptionRecord[]) => void;
  const cloudConsumptionsPromise = new Promise<ConsumptionRecord[]>((resolve) => {
    resolveCloudConsumptions = resolve;
  });

  let resolveCloudCustom!: (v: CustomFoodTemplate[]) => void;
  const cloudCustomPromise = new Promise<CustomFoodTemplate[]>((resolve) => {
    resolveCloudCustom = resolve;
  });

  const remoteDeletions: string[] = [];
  const mockFirestore = {
    getUserSettings: async () => staleCloudSettings,
    saveUserSettings: async () => {},
    getUserConsumptions: () => cloudConsumptionsPromise,
    saveConsumption: async () => {},
    deleteConsumption: async (uid: string, id: string) => {
      remoteDeletions.push(id);
    },
    getUserCustomFoods: () => cloudCustomPromise,
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // Start hydration (in-flight fetch)
  const refreshPromise = controller.refresh();

  // While hydration requests are in flight, user performs mutations:
  // 1. Delete meal
  await controller.deleteConsumption('meal_resurrect_target');
  // 2. Delete custom food
  await controller.deleteCustomFood('custom_resurrect_target');
  // 3. Update settings to 3200 kcal
  await controller.updateSettings({
    id: toOwnerKey(owner),
    dailyGoal: 3200,
    onboardingCompleted: true
  });

  // Verify outbox was acknowledged and drained
  const pending = await db.getPendingWrites(owner);
  assert.equal(pending.length, 0, 'Outbox was drained and acknowledged during hydration');

  // Stale cloud response arrives from before the deletions:
  resolveCloudConsumptions([staleCloudMeal]);
  resolveCloudCustom([staleCloudCustom]);
  await refreshPromise;

  // Verify absence in both state AND local IndexedDB:
  const state = controller.getState();
  assert.equal(state.allConsumptions.some(m => m.id === 'meal_resurrect_target'), false, 'Meal was NOT resurrected in state');
  assert.equal(state.customFoods.some(f => f.id === 'custom_resurrect_target'), false, 'Custom food was NOT resurrected in state');
  assert.equal(state.settings.dailyGoal, 3200, 'Settings update (3200 kcal) was preserved over stale snapshot (2000 kcal)');

  const localMeals = await db.getAllConsumptions(owner);
  assert.equal(localMeals.some(m => m.id === 'meal_resurrect_target'), false, 'Meal was NOT resurrected in IndexedDB');

  const localCustom = await db.getCustomFoods(owner);
  assert.equal(localCustom.some(f => f.id === 'custom_resurrect_target'), false, 'Custom food was NOT resurrected in IndexedDB');

  const localSettings = await db.getSettings(owner);
  assert.equal(localSettings.dailyGoal, 3200, 'IndexedDB settings preserved 3200 kcal');
});

// =========================================================================
// 16. importGuestData Strict Preflight & Partial Retry Routing
// =========================================================================
test('16. importGuestData aborts on preflight failure with zero local mutations; partial retry preserves target cloud settings', async () => {
  const guestIdentity = { kind: 'guest' as const };
  const userTarget = { kind: 'user' as const, uid: 'user_preflight_import' };

  await db.clearAllConsumptions(guestIdentity);
  await db.clearAllConsumptions(userTarget);

  const guestMeal: ConsumptionRecord = {
    id: 'g_m1_preflight',
    name: 'Preflight Meal',
    calories: 200,
    protein: 5,
    carbs: 20,
    fat: 5,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };
  await db.addConsumption(guestIdentity, guestMeal);

  // Preflight failure test: getUserCustomFoods throws
  const failingFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => { throw new Error('Settings should not be called'); },
    getUserConsumptions: async () => [],
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => { throw new Error('Network error on preflight custom foods'); },
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const failingController = new SyncController(userTarget, true, {
    firestore: failingFirestore as any,
    dbModule: db
  });

  await assert.rejects(
    async () => failingController.importGuestData(),
    /Cloud preflight failed/
  );

  // Verify zero local writes happened to target DB!
  const targetMealsAfterAbort = await db.getAllConsumptions(userTarget);
  assert.equal(targetMealsAfterAbort.length, 0, 'No local meals were written after preflight abort');

  // Now test partial failure + retry through serialized owner queue
  const remoteUploadedMeals: string[] = [];
  let shouldFailMeal2 = true;

  const userTargetSettings: UserSettings = {
    id: userTarget.uid,
    dailyGoal: 2800,
    onboardingCompleted: true
  };

  const guestMeal2: ConsumptionRecord = {
    id: 'g_m2_partial',
    name: 'Partial Meal 2',
    calories: 300,
    protein: 10,
    carbs: 30,
    fat: 5,
    servings: 1,
    mealCategory: 'Dinner',
    timestamp: 1700000005000
  };
  await db.addConsumption(guestIdentity, guestMeal2);

  const retryFirestore = {
    getUserSettings: async () => userTargetSettings,
    saveUserSettings: async () => { throw new Error('Cloud settings must remain untouched!'); },
    getUserConsumptions: async () => remoteUploadedMeals.map(id => ({ id, name: id, calories: 100, timestamp: 1700000000000 } as any)),
    saveConsumption: async (uid: string, r: any) => {
      if (r.id === 'g_m2_partial' && shouldFailMeal2) {
        throw new Error('Midway network interruption');
      }
      if (!remoteUploadedMeals.includes(r.id)) {
        remoteUploadedMeals.push(r.id);
      }
    },
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async (uid: string, s: any, meals: ConsumptionRecord[], _c: any, preserveCloud: boolean) => {
      if (!preserveCloud && s.dailyGoal) {
        throw new Error('Cloud settings must remain untouched!');
      }
      for (const m of meals) {
        if (m.id === 'g_m2_partial' && shouldFailMeal2) {
          throw new Error('Midway network interruption');
        }
        if (!remoteUploadedMeals.includes(m.id)) {
          remoteUploadedMeals.push(m.id);
        }
      }
      return { importedMeals: remoteUploadedMeals.length, importedCustomFoods: 0 };
    }
  };

  const retryController = new SyncController(userTarget, true, {
    firestore: retryFirestore as any,
    dbModule: db
  });

  // Attempt 1 fails midway on meal 2:
  await assert.rejects(
    async () => retryController.importGuestData(),
    /Midway network interruption/
  );

  assert.equal(remoteUploadedMeals.includes('g_m1_preflight'), true, 'Meal 1 uploaded in attempt 1');
  assert.equal(remoteUploadedMeals.includes('g_m2_partial'), false, 'Meal 2 failed in attempt 1');

  // Attempt 2 succeeds:
  shouldFailMeal2 = false;
  await retryController.importGuestData();

  assert.equal(remoteUploadedMeals.includes('g_m2_partial'), true, 'Meal 2 successfully uploaded on retry');
  assert.equal(userTargetSettings.dailyGoal, 2800, 'Cloud settings remained strictly untouched');
  assert.equal(retryController.getState().syncStatus, 'synced');
});

// =========================================================================
// 17. Durable Transactional Revisions Across Module Restart
// =========================================================================
test('17. Durable transactionally stored revisions survive module restart and prevent ABA across recreate', async () => {
  const owner = { kind: 'user' as const, uid: 'user_durable_revisions' };
  await db.clearPendingWrites(owner);
  await db.clearAllConsumptions(owner);

  const meal: ConsumptionRecord = {
    id: 'meal_durable_rev_1',
    name: 'Durable Revision Meal',
    calories: 250,
    protein: 10,
    carbs: 20,
    fat: 5,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };

  // Step 1: Save meal initially -> revision 1
  const write1 = await db.saveConsumptionAtomic(owner, meal);
  assert.equal(write1.revision, 1);

  // Step 2: Acknowledge revision 1 -> outbox entry is cleared
  const ack = await db.acknowledgePendingWrite(owner, write1.id, 1);
  assert.equal(ack, true);
  assert.equal((await db.getPendingWrites(owner)).length, 0);

  // Step 3: Simulate MODULE RESTART / RELOAD by clearing in-memory watermarks:
  db.resetRevisionWatermarksForTesting();

  // Step 4: Recreate the same meal ID after restart:
  // Durable watermark stored in IndexedDB must ensure revision is strictly greater than 1!
  const write2 = await db.saveConsumptionAtomic(owner, meal);
  assert.ok(
    write2.revision > 1,
    `Recreated meal revision (${write2.revision}) after simulated module restart must be > 1 (durable watermark preserved in IndexedDB)`
  );
});

// =========================================================================
// 18. Hydration Drain Serialization: No Concurrent Same-Owner Remote Requests
// =========================================================================
test('18. Hydration drain is serialized through owner chain; refresh overlapping an in-flight write cannot issue concurrent write', async () => {
  const owner = { kind: 'user' as const, uid: 'user_overlap_check' };
  await db.clearPendingWrites(owner);
  await db.clearAllConsumptions(owner);

  let activeConcurrentRemoteWrites = 0;
  let maxConcurrentRemoteWrites = 0;
  let resolveInFlightWrite!: () => void;
  const inFlightPromise = new Promise<void>((resolve) => {
    resolveInFlightWrite = resolve;
  });

  const mockFirestore = {
    getUserSettings: async () => ({ id: owner.uid, dailyGoal: 2000, onboardingCompleted: true }),
    saveUserSettings: async () => {},
    getUserConsumptions: async () => [],
    saveConsumption: async (uid: string, r: any) => {
      activeConcurrentRemoteWrites++;
      maxConcurrentRemoteWrites = Math.max(maxConcurrentRemoteWrites, activeConcurrentRemoteWrites);
      if (r.id === 'meal_inflight_1') {
        await inFlightPromise;
      }
      activeConcurrentRemoteWrites--;
    },
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async () => ({ importedMeals: 0, importedCustomFoods: 0 })
  };

  const controller = new SyncController(owner, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  const meal1: ConsumptionRecord = {
    id: 'meal_inflight_1',
    name: 'In-Flight Meal',
    calories: 400,
    protein: 20,
    carbs: 40,
    fat: 10,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };

  // 1. User initiates a mutation which starts an in-flight remote write
  const addPromise = controller.addConsumption(meal1);

  // Give a small tick so saveConsumption starts executing
  await new Promise(r => setTimeout(r, 10));
  assert.equal(activeConcurrentRemoteWrites, 1, 'Write 1 must be currently active on remote boundary');

  // 2. While write 1 is in-flight, a refresh / hydration load occurs
  const refreshPromise = controller.refresh();

  // Give another tick: loadDataForOwner runs getUserSettings, getUserConsumptions, and reaches scheduleDrain
  await new Promise(r => setTimeout(r, 20));

  // 3. CRITICAL: The refresh drain must NOT have issued a concurrent second write!
  assert.equal(activeConcurrentRemoteWrites, 1, 'Max concurrent remote writes must remain strictly 1 (no overlap)');
  assert.equal(maxConcurrentRemoteWrites, 1, 'Peak concurrent remote writes must never exceed 1');

  // 4. Resolve the in-flight write
  resolveInFlightWrite();
  await addPromise;
  await refreshPromise;

  assert.equal(activeConcurrentRemoteWrites, 0, 'All remote writes concluded cleanly');
  assert.equal(maxConcurrentRemoteWrites, 1, 'Peak concurrency was strictly 1 throughout execution');
  assert.equal(controller.getState().syncStatus, 'synced');
});

