import {LabOverlay} from './ui/LabOverlay';
import {LabAudioEngine} from './zgerze/labAudio';
import {
  getActiveSourceCount,
  pickRandomClip,
  registerDiscoveredVideos,
} from './zgerze/linkMatrix';
import {LiveVideoDiscovery} from './zgerze/liveDiscovery';
import {ClipCategory, ResolvedClip, SessionHistoryItem} from './zgerze/types';

class ZGerzeApp {
  private readonly audio = new LabAudioEngine();
  private readonly discovery = new LiveVideoDiscovery();
  private readonly history: SessionHistoryItem[] = [];
  private readonly recentVideoIds: string[] = [];

  private activeCategory: ClipCategory = ClipCategory.ALL;
  private randomStart = true;
  private totalRolls = 0;
  private armedClip!: ResolvedClip;

  private overlay!: LabOverlay;

  public start(): void {
    this.overlay = new LabOverlay(document.body, {
      onRedButtonClick: () => this.handleRedButtonOpened(),
      onSelectCategory: (category) => {
        this.activeCategory = category;
        this.armNextClip();
      },
      onClearHistory: () => {
        this.history.length = 0;
        this.recentVideoIds.length = 0;
        this.overlay.updateHistory(this.history);
      },
      onToggleMute: () => this.audio.toggleMute(),
      onToggleRandomStart: () => {
        this.randomStart = !this.randomStart;
        this.armNextClip();
        return this.randomStart;
      },
      onDiscoverMore: () => this.discoverMoreSources(),
    });

    this.armNextClip();
    // Enriquecimiento silencioso en segundo plano para expandir continuamente el catálogo
    void this.discoverMoreSources();
  }

  private armNextClip(): void {
    const excluded = new Set(this.recentVideoIds);
    this.armedClip = pickRandomClip({
      category: this.activeCategory,
      excludeVideoIds: excluded,
      randomStart: this.randomStart,
    });
    this.overlay.setArmedClip(this.armedClip);
  }

  private handleRedButtonOpened(): void {
    const openedClip = this.armedClip;
    this.audio.playButtonPress();

    this.totalRolls += 1;
    this.recentVideoIds.unshift(openedClip.video.id);
    if (this.recentVideoIds.length > 24) {
      this.recentVideoIds.pop();
    }

    this.history.unshift({
      clip: openedClip,
      triggeredAt: Date.now(),
      source: '2d-button',
    });
    if (this.history.length > 60) {
      this.history.pop();
    }

    this.overlay.updateRollCount(this.totalRolls);
    this.overlay.updateHistory(this.history);

    if (this.totalRolls % 5 === 0) {
      void this.discoverMoreSources();
    }

    // Esperar al siguiente tick para no alterar el href durante la navegación nativa del clic actual
    window.setTimeout(() => {
      this.armNextClip();
      this.audio.playButtonRelease();
    }, 0);
  }

  private async discoverMoreSources(): Promise<number> {
    const discovered = await this.discovery.fetchBatch(45);
    const added = registerDiscoveredVideos(discovered);
    if (added > 0) {
      this.overlay.updateSourceCount(getActiveSourceCount());
    }
    return added;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new ZGerzeApp();
  app.start();
});
