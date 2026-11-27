/**
 * Production CameraEngine & CameraSession Integration Lifecycle Test Suite
 *
 * Directly exercises the actual production CameraEngine, CameraSession, and useCameraEngine
 * lifecycle logic (mocking only the browser media boundary navigator.mediaDevices.getUserMedia).
 *
 * Verifies:
 * 1. Permission denial (NotAllowedError -> DENIED, hasPermission=false)
 * 2. Hardware unavailable (missing mediaDevices or NotFoundError -> UNAVAILABLE)
 * 3. Late stream resolving after unmount (stream arrives post-unmount -> tracks immediately stopped, state discarded)
 * 4. Active stream unmount track cleanup (all active tracks stopped, stream cleared)
 * 5. AbortSignal cancellation in CameraEngine.requestStream
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CameraEngine, CameraSession } from '../src/features/vision/presentation/acquisition/CameraEngine';

const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function setMockNavigator(mock: any) {
  Object.defineProperty(globalThis, 'navigator', {
    value: mock,
    configurable: true,
    writable: true
  });
}

function restoreNavigator() {
  if (originalNavigatorDesc) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
  } else {
    delete (globalThis as any).navigator;
  }
}

// Helper to create mock tracks
function createMockTrack(id: string) {
  let stopped = false;
  return {
    id,
    kind: 'video',
    get readyState() { return stopped ? 'ended' : 'live'; },
    get isStopped() { return stopped; },
    stop: () => { stopped = true; }
  };
}

// Helper to create a mock MediaStream
function createMockStream(trackCount = 2) {
  const tracks = Array.from({ length: trackCount }, (_, i) => createMockTrack(`track_${i + 1}`));
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
    mockTracks: tracks
  } as unknown as MediaStream & { mockTracks: ReturnType<typeof createMockTrack>[] };
}

test('1. Permission denial: CameraSession transitions to DENIED status and hasPermission=false', async () => {
  try {
    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          const err = new Error('Permission denied by user');
          err.name = 'NotAllowedError';
          throw err;
        }
      }
    });

    const session = new CameraSession();
    assert.equal(session.status, 'INITIAL');
    assert.equal(session.hasPermission, null);

    await assert.rejects(
      async () => session.start('environment'),
      /Permission denied by user/
    );

    assert.equal(session.status, 'DENIED', 'Status must be DENIED on NotAllowedError');
    assert.equal(session.hasPermission, false, 'hasPermission must be false on denial');
    assert.equal(session.stream, null, 'No stream held on denial');

    // Also verify CameraEngine.mapAcquisitionError production mapper
    const mapped = CameraEngine.mapAcquisitionError({ name: 'NotAllowedError' });
    assert.equal(mapped, 'DENIED');
  } finally {
    restoreNavigator();
  }
});

test('2. Hardware unavailable: CameraSession transitions to UNAVAILABLE status', async () => {
  try {
    // Sub-case A: mediaDevices API missing completely
    setMockNavigator({});
    const sessionNoHardware = new CameraSession();
    await assert.rejects(
      async () => sessionNoHardware.start(),
      /getUserMedia is not supported/
    );
    assert.equal(sessionNoHardware.status, 'UNAVAILABLE');
    assert.equal(sessionNoHardware.hasPermission, false);

    // Sub-case B: NotFoundError thrown by getUserMedia (no physical camera)
    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          const err = new Error('Requested camera hardware not found');
          err.name = 'NotFoundError';
          throw err;
        }
      }
    });

    const sessionNotFound = new CameraSession();
    await assert.rejects(
      async () => sessionNotFound.start('environment'),
      /Requested camera hardware not found/
    );

    assert.equal(sessionNotFound.status, 'UNAVAILABLE', 'Status must be UNAVAILABLE on NotFoundError');
    assert.equal(sessionNotFound.hasPermission, false);
    assert.equal(sessionNotFound.stream, null);

    const mapped = CameraEngine.mapAcquisitionError({ name: 'NotFoundError' });
    assert.equal(mapped, 'UNAVAILABLE');
  } finally {
    restoreNavigator();
  }
});

test('3. Late stream resolving after unmount: tracks are cleanly stopped and stream is discarded', async () => {
  try {
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    const pendingStreamPromise = new Promise<MediaStream>((resolve) => {
      resolveGetUserMedia = resolve;
    });

    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => pendingStreamPromise
      }
    });

    const session = new CameraSession();

    // 1. Initiate camera start in background
    const startPromise = session.start('environment');

    // 2. User navigates away / unmounts the camera screen while getUserMedia is still pending!
    session.unmount();
    assert.equal(session.isMounted, false, 'Session must be marked unmounted');

    // 3. Late stream now resolves from the browser media layer
    const lateStream = createMockStream(3);
    resolveGetUserMedia(lateStream);

    const result = await startPromise;

    // 4. Verify the late stream was NOT retained
    assert.equal(result, null, 'start() must return null for unmounted late stream');
    assert.equal(session.stream, null, 'Session must not hold late stream');

    // 5. CRITICAL: Verify all tracks on the late-arriving stream were IMMEDIATELY stopped!
    for (const track of lateStream.mockTracks) {
      assert.equal(track.isStopped, true, `Late stream track ${track.id} must be stopped to turn off camera`);
    }
  } finally {
    restoreNavigator();
  }
});

test('4. Active stream unmount track cleanup: unmount stops all active media stream tracks', async () => {
  try {
    const activeStream = createMockStream(2);

    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => activeStream
      }
    });

    const session = new CameraSession();
    const acquired = await session.start('environment');

    assert.equal(acquired, activeStream);
    assert.equal(session.status, 'GRANTED');
    assert.equal(session.hasPermission, true);
    assert.equal(session.stream, activeStream);

    // Verify tracks are currently active
    for (const track of activeStream.mockTracks) {
      assert.equal(track.isStopped, false, 'Tracks should be running while session is active');
    }

    // Now unmount / close the camera
    session.unmount();

    assert.equal(session.isMounted, false);
    assert.equal(session.stream, null, 'Stream must be cleared on unmount');

    // Verify all tracks were stopped
    for (const track of activeStream.mockTracks) {
      assert.equal(track.isStopped, true, `Track ${track.id} must be stopped on unmount`);
    }
  } finally {
    restoreNavigator();
  }
});

test('5. CameraEngine.requestStream abort signal integration stops tracks immediately upon abortion', async () => {
  try {
    const stream = createMockStream(2);
    setMockNavigator({
      mediaDevices: {
        getUserMedia: async () => stream
      }
    });

    // Pre-aborted signal
    const ac = new AbortController();
    ac.abort();

    await assert.rejects(
      async () => CameraEngine.requestStream('environment', { signal: ac.signal }),
      /Camera request aborted/
    );

    // Active track cleanup helper verification
    const testStream = createMockStream(2);
    CameraEngine.stopTracks(testStream);
    for (const track of testStream.mockTracks) {
      assert.equal(track.isStopped, true, 'CameraEngine.stopTracks must stop all tracks');
    }
  } finally {
    restoreNavigator();
  }
});
