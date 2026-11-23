import {
  CatalogVideo,
  ClipCategory,
  LinkMatrixShard,
  ResolvedClip,
} from './types';
import {YOUTUBE_CATALOG} from './youtubeCatalog';

/**
 * Matriz base + flujo infinito (∞):
 * Parte de una base determinista de 950,400,000,000 combinaciones y proyecta
 * índices ilimitados hacia el catálogo vivo en expansión continua (∞).
 */
export const TIMESTAMP_BUCKETS = 360;
export const CLIP_WINDOW_VARIANTS = 25;
export const SHARD_SECTORS = 880;
export const SUB_BANDS = 1000;
export const TOTAL_YOUTUBE_LINKS =
  YOUTUBE_CATALOG.length *
  TIMESTAMP_BUCKETS *
  CLIP_WINDOW_VARIANTS *
  SHARD_SECTORS *
  SUB_BANDS;

export const MINIMUM_GUARANTEED_LINKS = 800_000_000_000;
export const INFINITE_SYMBOL = '∞';

const dynamicCatalog: CatalogVideo[] = [...YOUTUBE_CATALOG];
const knownVideoIds = new Set<string>(YOUTUBE_CATALOG.map((v) => v.id));

/**
 * Añade nuevos videos reales descubiertos en tiempo real al flujo infinito.
 * Retorna la cantidad de videos nuevos agregados.
 */
export function registerDiscoveredVideos(
  videos: readonly CatalogVideo[]
): number {
  let added = 0;
  for (const video of videos) {
    if (!video.id || knownVideoIds.has(video.id)) continue;
    knownVideoIds.add(video.id);
    dynamicCatalog.push(video);
    added += 1;
  }
  return added;
}

export function getLiveCatalog(): readonly CatalogVideo[] {
  return dynamicCatalog;
}

export function getActiveSourceCount(): number {
  return dynamicCatalog.length;
}

const SECTOR_PREFIXES = [
  'ALFA',
  'BETA',
  'GAMMA',
  'DELTA',
  'EPSILON',
  'ZETA',
  'ETA',
  'THETA',
  'SIGMA',
  'OMEGA',
  'QUARK',
  'PHOTON',
  'NEBULA',
  'VECTOR',
  'PULSE',
  'PRISM',
] as const;

export const LINK_MATRIX_SHARDS: readonly LinkMatrixShard[] = Array.from(
  {length: SHARD_SECTORS},
  (_, shardId) => {
    const prefix = SECTOR_PREFIXES[shardId % SECTOR_PREFIXES.length];
    const band = Math.floor(shardId / SECTOR_PREFIXES.length) + 1;
    const hex = ((shardId * 2654435761) >>> 0)
      .toString(16)
      .padStart(8, '0')
      .slice(0, 6)
      .toUpperCase();
    return {
      shardId,
      code: `${prefix}-${String(band).padStart(2, '0')}-${hex}`,
      label: `Sector ${prefix} ${band}`,
      parameterTag: `zg_${shardId.toString(36).padStart(3, '0')}`,
      slotWeight:
        YOUTUBE_CATALOG.length *
        TIMESTAMP_BUCKETS *
        CLIP_WINDOW_VARIANTS *
        SUB_BANDS,
    };
  }
);

const CLIP_DURATIONS_SEC = [
  15, 18, 20, 22, 25, 28, 30, 34, 38, 42, 45, 48, 52, 55, 60, 65, 70, 75, 80,
  85, 90, 95, 100, 110, 120,
] as const;

const FEISTEL_HALF_MASK = (1n << 20n) - 1n;
const TOTAL_LINKS_BIG = BigInt(TOTAL_YOUTUBE_LINKS);

function feistelRound20(half: bigint, roundKey: bigint): bigint {
  let x = (half ^ roundKey) & FEISTEL_HALF_MASK;
  x = ((x ^ (x >> 7n)) * 0x45d9fn) & FEISTEL_HALF_MASK;
  x = ((x ^ (x >> 9n)) * 0x119den) & FEISTEL_HALF_MASK;
  return (x ^ (x >> 6n)) & FEISTEL_HALF_MASK;
}

/**
 * Permutación biyectiva de 40 bits con cycle-walking sobre bloques de 950,400,000,000 slots.
 * Para índices ilimitados, conserva el ciclo infinito sin truncar la coordenada superior.
 */
export function permuteSlot(rawIndex: number, seed = 0x5a474552): number {
  const safeAbs = Math.max(0, Math.trunc(Math.abs(rawIndex)));
  const cycleOffset =
    Math.floor(safeAbs / TOTAL_YOUTUBE_LINKS) * TOTAL_YOUTUBE_LINKS;
  let value = BigInt(safeAbs % TOTAL_YOUTUBE_LINKS);
  const bigSeed = BigInt(seed >>> 0);

  do {
    let left = (value >> 20n) & FEISTEL_HALF_MASK;
    let right = value & FEISTEL_HALF_MASK;
    for (let r = 0n; r < 4n; r++) {
      const roundKey =
        ((bigSeed >> (r * 4n)) ^ (r * 0x9e37n)) & FEISTEL_HALF_MASK;
      const nextLeft = right;
      const nextRight = left ^ feistelRound20(right, roundKey);
      left = nextLeft;
      right = nextRight;
    }
    value = (left << 20n) | right;
  } while (value >= TOTAL_LINKS_BIG);

  return cycleOffset + Number(value);
}

export function formatNumberEs(num: number): string {
  return num.toLocaleString('en-US');
}

export function buildWatchUrl(
  videoId: string,
  startSeconds: number,
  shardTag: string
): string {
  const safeStart = Math.max(0, Math.floor(startSeconds));
  return `https://www.youtube.com/watch?v=${videoId}&t=${safeStart}s&zgerze=${shardTag}`;
}

export function buildEmbedUrl(
  videoId: string,
  startSeconds: number,
  autoplay = true
): string {
  const safeStart = Math.max(0, Math.floor(startSeconds));
  const params = new URLSearchParams({
    start: String(safeStart),
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Resuelve cualquier índice entero no negativo (sin límite superior: ∞)
 * hacia un clip real de YouTube del catálogo vivo en expansión.
 */
export function resolveLinkBySlot(slotIndex: number): ResolvedClip {
  const safeSlot = Math.max(0, Math.trunc(Math.abs(slotIndex)));
  const catalog = dynamicCatalog;

  let rem = safeSlot;

  const videoIndex = rem % catalog.length;
  rem = Math.floor(rem / catalog.length);

  const timeBucket = rem % TIMESTAMP_BUCKETS;
  rem = Math.floor(rem / TIMESTAMP_BUCKETS);

  const windowVariant = rem % CLIP_WINDOW_VARIANTS;
  rem = Math.floor(rem / CLIP_WINDOW_VARIANTS);

  const shardIndex = rem % SHARD_SECTORS;
  rem = Math.floor(rem / SHARD_SECTORS);

  const subBand = rem % SUB_BANDS;
  const infiniteCycle = Math.floor(rem / SUB_BANDS);

  const video = catalog[videoIndex];
  const shard = LINK_MATRIX_SHARDS[shardIndex];

  const maxStart = Math.max(0, video.durationSec - 15);
  const startSeconds =
    maxStart === 0
      ? 0
      : Math.floor((timeBucket / TIMESTAMP_BUCKETS) * maxStart);

  const clipDurationSeconds = CLIP_DURATIONS_SEC[windowVariant];
  const bandSuffix = String(subBand).padStart(3, '0');
  const cycleTag = infiniteCycle > 0 ? `-${infiniteCycle}` : '';

  return {
    slotIndex: safeSlot,
    totalLinks: TOTAL_YOUTUBE_LINKS,
    totalLinksLabel: INFINITE_SYMBOL,
    formattedSlot: `#${formatNumberEs(safeSlot + 1)}`,
    shardCode: `${shard.code}-${bandSuffix}${cycleTag}`,
    video,
    startSeconds,
    clipDurationSeconds,
    watchUrl: buildWatchUrl(
      video.id,
      startSeconds,
      `${shard.parameterTag}_${bandSuffix}${infiniteCycle > 0 ? `_${infiniteCycle}` : ''}`
    ),
    embedUrl: buildEmbedUrl(video.id, startSeconds, true),
    thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
  };
}

export function getVideosForCategory(
  category: ClipCategory
): readonly CatalogVideo[] {
  if (category === ClipCategory.ALL) return dynamicCatalog;
  return dynamicCatalog.filter((v) => v.category === category);
}

export interface PickRandomClipOptions {
  category?: ClipCategory;
  excludeVideoIds?: ReadonlySet<string>;
  randomFn?: () => number;
  autoplay?: boolean;
  randomStart?: boolean;
}

// Espacio seguro de muestreo continuo (2^48 = 281,474,976,710,656 combinaciones activas sin techo fijo)
const INFINITE_STREAM_SPAN = 281_474_976_710_656;

/**
 * Selecciona aleatoriamente un clip dentro del flujo infinito de YouTube,
 * priorizando videos aún no vistos en la sesión y respetando el filtro de categoría.
 */
export function pickRandomClip(
  options: PickRandomClipOptions = {}
): ResolvedClip {
  const {
    category = ClipCategory.ALL,
    excludeVideoIds,
    randomFn = Math.random,
    autoplay = true,
    randomStart = true,
  } = options;

  const finalizeClip = (clip: ResolvedClip): ResolvedClip => {
    const startSec = randomStart ? clip.startSeconds : 0;
    const tagMatch = clip.watchUrl.match(/&zgerze=([^&]+)/);
    const shardTag = tagMatch ? tagMatch[1] : 'zg_000';
    return {
      ...clip,
      startSeconds: startSec,
      watchUrl: buildWatchUrl(clip.video.id, startSec, shardTag),
      embedUrl: buildEmbedUrl(clip.video.id, startSec, autoplay),
    };
  };

  const catalog = dynamicCatalog;
  const maxAttempts = 28;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rawSlot = Math.floor(randomFn() * INFINITE_STREAM_SPAN);
    const scrambledSlot = permuteSlot(rawSlot + attempt * 7919);
    const candidate = resolveLinkBySlot(scrambledSlot);

    if (
      category !== ClipCategory.ALL &&
      candidate.video.category !== category
    ) {
      const pool = getVideosForCategory(category);
      if (pool.length === 0) return finalizeClip(candidate);
      const targetVideo = pool[scrambledSlot % pool.length];
      const videoIdx = catalog.findIndex((v) => v.id === targetVideo.id);
      const bucketBase = Math.floor(scrambledSlot / catalog.length);
      const projectedSlot = bucketBase * catalog.length + videoIdx;
      const projected = resolveLinkBySlot(projectedSlot);
      if (!excludeVideoIds || !excludeVideoIds.has(projected.video.id)) {
        return finalizeClip(projected);
      }
      continue;
    }

    if (!excludeVideoIds || !excludeVideoIds.has(candidate.video.id)) {
      return finalizeClip(candidate);
    }
  }

  const fallbackRaw = Math.floor(randomFn() * INFINITE_STREAM_SPAN);
  return finalizeClip(resolveLinkBySlot(permuteSlot(fallbackRaw)));
}

export function formatDurationTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getCategoryLabel(category: ClipCategory): string {
  switch (category) {
    case ClipCategory.ALL:
      return 'Todos los canales';
    case ClipCategory.SCIENCE:
      return 'Ciencia & Espacio';
    case ClipCategory.MUSIC:
      return 'Música & Synth';
    case ClipCategory.NATURE:
      return 'Naturaleza 4K';
    case ClipCategory.RETRO:
      return 'Retro & VHS';
    case ClipCategory.INTERNET:
      return 'Internet Clásico';
    case ClipCategory.ART:
      return 'Arte & 3D';
  }
}
