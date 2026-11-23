import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFINITE_SYMBOL,
  LINK_MATRIX_SHARDS,
  MINIMUM_GUARANTEED_LINKS,
  TOTAL_YOUTUBE_LINKS,
  formatDurationTimestamp,
  getActiveSourceCount,
  permuteSlot,
  pickRandomClip,
  registerDiscoveredVideos,
  resolveLinkBySlot,
} from './linkMatrix';
import {YOUTUBE_CATALOG} from './youtubeCatalog';
import {ClipCategory} from './types';

test('catalog exceeds 800,000,000,000 base links and exposes infinite label', () => {
  assert.ok(
    TOTAL_YOUTUBE_LINKS > MINIMUM_GUARANTEED_LINKS,
    `Expected > 800,000,000,000 links, got ${TOTAL_YOUTUBE_LINKS}`
  );
  assert.equal(TOTAL_YOUTUBE_LINKS, 950_400_000_000);
  assert.equal(YOUTUBE_CATALOG.length, 120);
  assert.equal(LINK_MATRIX_SHARDS.length, 880);
  assert.equal(INFINITE_SYMBOL, '∞');
});

test('resolveLinkBySlot handles unbounded infinite slots deterministically', () => {
  const first = resolveLinkBySlot(0);
  const farBeyondFinite = resolveLinkBySlot(42_819_003_112_501);
  const repeatFar = resolveLinkBySlot(42_819_003_112_501);

  assert.equal(first.slotIndex, 0);
  assert.equal(first.totalLinksLabel, '∞');
  assert.equal(farBeyondFinite.slotIndex, 42_819_003_112_501);
  assert.equal(farBeyondFinite.totalLinksLabel, '∞');
  assert.deepEqual(farBeyondFinite, repeatFar);

  for (const clip of [first, farBeyondFinite]) {
    assert.match(
      clip.watchUrl,
      /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}&t=\d+s&zgerze=zg_/
    );
    assert.match(
      clip.embedUrl,
      /^https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]{11}\?/
    );
    assert.ok(clip.startSeconds >= 0);
    assert.ok(clip.startSeconds <= clip.video.durationSec);
  }
});

test('registerDiscoveredVideos expands live pool and deduplicates IDs', () => {
  const before = getActiveSourceCount();
  const added = registerDiscoveredVideos([
    {
      id: 'dQw4w9WgXc9',
      title: 'Nuevo Video Descubierto',
      channel: 'Red en Vivo',
      category: ClipCategory.MUSIC,
      durationSec: 210,
      year: 2026,
    },
    {
      id: 'dQw4w9WgXc9',
      title: 'Duplicado',
      channel: 'Red en Vivo',
      category: ClipCategory.MUSIC,
      durationSec: 210,
      year: 2026,
    },
  ]);

  assert.equal(added, 1);
  assert.equal(getActiveSourceCount(), before + 1);
});

test('permuteSlot is bijective over sampled indices across infinite cycles', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const out = permuteSlot(i * 1_900_000_003);
    assert.ok(out >= 0);
    assert.equal(seen.has(out), false);
    seen.add(out);
  }
});

test('pickRandomClip respects category filters, exclusions, and autoplay', () => {
  const excluded = new Set<string>(['E32i8dK_e6s']);
  let step = 0;
  const deterministicRng = () => {
    step += 1;
    return (step * 0.3719) % 1;
  };

  const clip = pickRandomClip({
    category: ClipCategory.SCIENCE,
    excludeVideoIds: excluded,
    randomFn: deterministicRng,
    autoplay: false,
    randomStart: false,
  });

  assert.equal(clip.video.category, ClipCategory.SCIENCE);
  assert.notEqual(clip.video.id, 'E32i8dK_e6s');
  assert.equal(clip.startSeconds, 0);
  assert.match(clip.watchUrl, /&t=0s/);
  assert.match(clip.embedUrl, /autoplay=0/);
});

test('formatDurationTimestamp formats mm:ss accurately', () => {
  assert.equal(formatDurationTimestamp(0), '00:00');
  assert.equal(formatDurationTimestamp(65), '01:05');
  assert.equal(formatDurationTimestamp(3605), '60:05');
});
