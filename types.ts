export enum ClipCategory {
  ALL = 'todos',
  SCIENCE = 'ciencia',
  MUSIC = 'musica',
  NATURE = 'naturaleza',
  RETRO = 'retro',
  INTERNET = 'internet',
  ART = 'arte',
}

export interface CatalogVideo {
  id: string;
  title: string;
  channel: string;
  category: Exclude<ClipCategory, ClipCategory.ALL>;
  durationSec: number;
  year: number;
}

export interface LinkMatrixShard {
  shardId: number;
  code: string;
  label: string;
  parameterTag: string;
  slotWeight: number;
}

export interface ResolvedClip {
  slotIndex: number;
  totalLinks: number;
  totalLinksLabel: string;
  formattedSlot: string;
  shardCode: string;
  video: CatalogVideo;
  startSeconds: number;
  clipDurationSeconds: number;
  watchUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

export interface SessionHistoryItem {
  clip: ResolvedClip;
  triggeredAt: number;
  source:
    | '2d-button'
    | '3d-button'
    | 'xr-ui'
    | 'keyboard'
    | 'auto-reroll'
    | 'infinite-next';
}

export type LabStatus = 'standby' | 'tuning' | 'playing' | 'error-rerolling';
