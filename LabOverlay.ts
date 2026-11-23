import {
  formatDurationTimestamp,
  getActiveSourceCount,
} from '../zgerze/linkMatrix';
import {
  ClipCategory,
  ResolvedClip,
  SessionHistoryItem,
} from '../zgerze/types';

export interface LabOverlayCallbacks {
  onRedButtonClick: () => void;
  onSelectCategory: (category: ClipCategory) => void;
  onClearHistory: () => void;
  onToggleMute: () => boolean;
  onToggleRandomStart: () => boolean;
  onDiscoverMore: () => Promise<number>;
}

const CATEGORIES: readonly {id: ClipCategory; shortLabel: string}[] = [
  {id: ClipCategory.ALL, shortLabel: 'Todos'},
  {id: ClipCategory.SCIENCE, shortLabel: 'Ciencia'},
  {id: ClipCategory.MUSIC, shortLabel: 'Música'},
  {id: ClipCategory.NATURE, shortLabel: 'Naturaleza'},
  {id: ClipCategory.RETRO, shortLabel: 'Retro'},
  {id: ClipCategory.INTERNET, shortLabel: 'Internet'},
  {id: ClipCategory.ART, shortLabel: 'Arte 3D'},
];

/**
 * Interfaz fiel a la captura de referencia sin reproductor invasivo en pantalla:
 * - Al presionar el botón circular rojo, abre una pestaña nueva directa al video aleatorio de YouTube.
 * - Botón superior derecho negro de tres rayitas con opciones de categoría, sonido, tiempo inicial,
 *   exploración en vivo e historial de videos abiertos.
 */
export class LabOverlay {
  private readonly root: HTMLElement;
  private readonly callbacks: LabOverlayCallbacks;

  private menuBtn!: HTMLButtonElement;
  private menuDrawer!: HTMLElement;
  private drawerSubEl!: HTMLElement;
  private muteToggleBtn!: HTMLButtonElement;
  private randomStartToggleBtn!: HTMLButtonElement;
  private discoverBtn!: HTMLButtonElement;
  private clearHistoryBtn!: HTMLButtonElement;
  private historyCountEl!: HTMLElement;
  private historyListEl!: HTMLElement;
  private rollCountEl!: HTMLElement;
  private categoryButtons = new Map<ClipCategory, HTMLButtonElement>();

  private redButtonEl!: HTMLAnchorElement;
  private captionBlock!: HTMLElement;

  private activeCategory: ClipCategory = ClipCategory.ALL;
  private menuOpen = false;
  private pressVisualTimeout: number | null = null;

  private readonly onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.menuOpen) {
      this.toggleMenu(false);
      return;
    }
    if (
      event.code === 'Space' &&
      !event.repeat &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement) &&
      !(event.target instanceof HTMLButtonElement) &&
      !(event.target instanceof HTMLAnchorElement)
    ) {
      event.preventDefault();
      this.redButtonEl.click();
    }
  };

  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.menuOpen) return;
    const target = event.target as Node | null;
    if (
      target &&
      !this.menuDrawer.contains(target) &&
      !this.menuBtn.contains(target)
    ) {
      this.toggleMenu(false);
    }
  };

  constructor(mountTarget: HTMLElement, callbacks: LabOverlayCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.className = 'rv-page';
    this.root.setAttribute('data-testid', 'zgerze-hud');
    this.buildDOM();
    mountTarget.appendChild(this.root);

    window.addEventListener('keydown', this.onWindowKeyDown);
    document.addEventListener('pointerdown', this.onDocumentPointerDown);
  }

  private buildDOM(): void {
    // 1. Botón superior derecho negro de "tres rayitas" con estilo del botón rojo
    this.menuBtn = document.createElement('button');
    this.menuBtn.type = 'button';
    this.menuBtn.className = 'rv-menu-btn';
    this.menuBtn.setAttribute('data-testid', 'zgerze-menu-btn');
    this.menuBtn.setAttribute('aria-label', 'Abrir menú de opciones');
    this.menuBtn.setAttribute('aria-expanded', 'false');
    this.menuBtn.innerHTML = `
      <span class="rv-menu-bezel" aria-hidden="true">
        <span class="rv-menu-dome">
          <span class="rv-menu-gloss"></span>
          <span class="rv-menu-bars">
            <span class="rv-menu-bar"></span>
            <span class="rv-menu-bar"></span>
            <span class="rv-menu-bar"></span>
          </span>
        </span>
      </span>
    `;
    this.menuBtn.addEventListener('click', () => this.toggleMenu());

    // 2. Panel desplegable de opciones al tocar las tres rayitas
    this.menuDrawer = document.createElement('aside');
    this.menuDrawer.className = 'rv-menu-drawer';
    this.menuDrawer.setAttribute('data-testid', 'zgerze-menu-drawer');
    this.menuDrawer.setAttribute('aria-label', 'Opciones de ZGerze');
    this.menuDrawer.hidden = true;

    const drawerHeader = document.createElement('div');
    drawerHeader.className = 'rv-drawer-header';
    const headerInfo = document.createElement('div');
    const headerBrand = document.createElement('strong');
    headerBrand.className = 'rv-drawer-brand';
    headerBrand.textContent = 'ZGerze • ∞ Videos';
    this.drawerSubEl = document.createElement('span');
    this.drawerSubEl.className = 'rv-drawer-sub';
    this.drawerSubEl.setAttribute('data-testid', 'zgerze-sources-count');
    this.drawerSubEl.textContent = `∞ flujo continuo (${getActiveSourceCount()} fuentes en vivo)`;
    headerInfo.append(headerBrand, this.drawerSubEl);

    const closeMenuBtn = document.createElement('button');
    closeMenuBtn.type = 'button';
    closeMenuBtn.className = 'rv-mini-btn';
    closeMenuBtn.textContent = 'Cerrar';
    closeMenuBtn.addEventListener('click', () => this.toggleMenu(false));
    drawerHeader.append(headerInfo, closeMenuBtn);

    // Opción 1: Categoría
    const catSection = document.createElement('div');
    catSection.className = 'rv-drawer-section';
    const catLabel = document.createElement('div');
    catLabel.className = 'rv-drawer-label';
    catLabel.textContent = 'Categoría de video';
    const catGrid = document.createElement('div');
    catGrid.className = 'rv-cat-grid';
    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rv-cat-chip';
      btn.textContent = cat.shortLabel;
      const isActive = cat.id === this.activeCategory;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
      btn.addEventListener('click', () => {
        this.setActiveCategory(cat.id);
        this.callbacks.onSelectCategory(cat.id);
      });
      this.categoryButtons.set(cat.id, btn);
      catGrid.appendChild(btn);
    }
    catSection.append(catLabel, catGrid);

    // Opción 2: Preferencias
    const togglesSection = document.createElement('div');
    togglesSection.className = 'rv-drawer-section';
    const togglesLabel = document.createElement('div');
    togglesLabel.className = 'rv-drawer-label';
    togglesLabel.textContent = 'Preferencias';

    const togglesRow = document.createElement('div');
    togglesRow.className = 'rv-toggles-row';

    this.muteToggleBtn = document.createElement('button');
    this.muteToggleBtn.type = 'button';
    this.muteToggleBtn.className = 'rv-option-btn is-on';
    this.muteToggleBtn.textContent = 'Sonido: ON';
    this.muteToggleBtn.setAttribute('aria-pressed', 'true');
    this.muteToggleBtn.addEventListener('click', () => {
      const muted = this.callbacks.onToggleMute();
      this.muteToggleBtn.textContent = muted ? 'Sonido: OFF' : 'Sonido: ON';
      this.muteToggleBtn.classList.toggle('is-on', !muted);
      this.muteToggleBtn.setAttribute('aria-pressed', String(!muted));
    });

    this.randomStartToggleBtn = document.createElement('button');
    this.randomStartToggleBtn.type = 'button';
    this.randomStartToggleBtn.className = 'rv-option-btn is-on';
    this.randomStartToggleBtn.textContent = 'Minuto azar: ON';
    this.randomStartToggleBtn.setAttribute('aria-pressed', 'true');
    this.randomStartToggleBtn.addEventListener('click', () => {
      const randomStart = this.callbacks.onToggleRandomStart();
      this.randomStartToggleBtn.textContent = randomStart
        ? 'Minuto azar: ON'
        : 'Minuto azar: OFF';
      this.randomStartToggleBtn.classList.toggle('is-on', randomStart);
      this.randomStartToggleBtn.setAttribute('aria-pressed', String(randomStart));
    });

    this.discoverBtn = document.createElement('button');
    this.discoverBtn.type = 'button';
    this.discoverBtn.className = 'rv-option-btn rv-option-wide';
    this.discoverBtn.textContent = '+ Explorar más videos de la red';
    this.discoverBtn.addEventListener('click', async () => {
      this.discoverBtn.disabled = true;
      this.discoverBtn.textContent = 'Buscando fuentes...';
      const added = await this.callbacks.onDiscoverMore();
      this.discoverBtn.textContent =
        added > 0 ? `+${added} videos agregados` : 'Catálogo al día';
      window.setTimeout(() => {
        this.discoverBtn.textContent = '+ Explorar más videos de la red';
        this.discoverBtn.disabled = false;
      }, 1500);
    });

    togglesRow.append(
      this.muteToggleBtn,
      this.randomStartToggleBtn,
      this.discoverBtn
    );

    this.rollCountEl = document.createElement('div');
    this.rollCountEl.className = 'rv-roll-stat';
    this.rollCountEl.textContent = 'Videos abiertos en esta sesión: 0';

    togglesSection.append(togglesLabel, togglesRow, this.rollCountEl);

    // Opción 3: Historial de videos abiertos
    const historySection = document.createElement('div');
    historySection.className = 'rv-drawer-section';
    const historyHead = document.createElement('div');
    historyHead.className = 'rv-history-head';
    this.historyCountEl = document.createElement('span');
    this.historyCountEl.className = 'rv-drawer-label';
    this.historyCountEl.textContent = 'Historial reciente (0)';

    this.clearHistoryBtn = document.createElement('button');
    this.clearHistoryBtn.type = 'button';
    this.clearHistoryBtn.className = 'rv-mini-btn';
    this.clearHistoryBtn.textContent = 'Limpiar';
    this.clearHistoryBtn.hidden = true;
    this.clearHistoryBtn.addEventListener('click', () =>
      this.callbacks.onClearHistory()
    );

    historyHead.append(this.historyCountEl, this.clearHistoryBtn);

    this.historyListEl = document.createElement('div');
    this.historyListEl.className = 'rv-history-list';
    this.historyListEl.innerHTML =
      '<p class="rv-history-empty">Presiona el botón rojo para abrir un video aleatorio en YouTube.</p>';

    historySection.append(historyHead, this.historyListEl);

    this.menuDrawer.append(
      drawerHeader,
      catSection,
      togglesSection,
      historySection
    );

    // 3. Contenido central 100% fiel a la captura de pantalla
    const main = document.createElement('main');
    main.className = 'rv-main';

    const titleBlock = document.createElement('header');
    titleBlock.className = 'rv-header';
    titleBlock.innerHTML = `
      <h1 class="rv-title">The random video</h1>
      <p class="rv-subtitle">My TikTok username is: valeny62</p>
    `;

    // El botón circular rojo brillante es un enlace nativo target="_blank" que cambia de pestaña directo a YouTube
    const buttonWrap = document.createElement('div');
    buttonWrap.className = 'rv-button-wrap';

    this.redButtonEl = document.createElement('a');
    this.redButtonEl.className = 'rv-red-button';
    this.redButtonEl.target = '_blank';
    this.redButtonEl.rel = 'noopener noreferrer';
    this.redButtonEl.href = 'https://www.youtube.com/';
    this.redButtonEl.setAttribute('role', 'button');
    this.redButtonEl.setAttribute('data-testid', 'zgerze-red-button');
    this.redButtonEl.setAttribute(
      'aria-label',
      'Press the button to load a random video'
    );
    this.redButtonEl.innerHTML = `
      <span class="rv-btn-ring" aria-hidden="true">
        <span class="rv-btn-dome">
          <span class="rv-btn-gloss"></span>
        </span>
      </span>
    `;
    this.redButtonEl.addEventListener('click', () => {
      this.triggerVisualButtonPress();
      this.callbacks.onRedButtonClick();
    });

    buttonWrap.appendChild(this.redButtonEl);

    this.captionBlock = document.createElement('footer');
    this.captionBlock.className = 'rv-captions';
    this.captionBlock.innerHTML = `
      <p class="rv-cap-en">Press the button to load a random video</p>
      <p class="rv-cap-es">presiona el botón para cargar un video random</p>
      <p class="rv-cap-zh">按下按鈕加載隨機視頻</p>
      <p class="rv-cap-ko">버튼을 눌러 임의의 영상을 불러오세요</p>
      <p class="rv-copyright">Copyright 2026</p>
    `;

    main.append(titleBlock, buttonWrap, this.captionBlock);

    this.root.append(this.menuBtn, this.menuDrawer, main);
  }

  public setArmedClip(clip: ResolvedClip): void {
    this.redButtonEl.href = clip.watchUrl;
  }

  public setActiveCategory(category: ClipCategory): void {
    this.activeCategory = category;
    for (const [id, btn] of this.categoryButtons.entries()) {
      const active = id === category;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
  }

  public triggerVisualButtonPress(): void {
    this.redButtonEl.classList.add('is-pressed');
    if (this.pressVisualTimeout !== null) {
      window.clearTimeout(this.pressVisualTimeout);
    }
    this.pressVisualTimeout = window.setTimeout(() => {
      this.redButtonEl.classList.remove('is-pressed');
      this.pressVisualTimeout = null;
    }, 160);
  }

  public updateSourceCount(count: number): void {
    this.drawerSubEl.textContent = `∞ flujo continuo (${count} fuentes en vivo)`;
  }

  public updateRollCount(totalRolls: number): void {
    this.rollCountEl.textContent = `Videos abiertos en esta sesión: ${totalRolls}`;
  }

  public updateHistory(items: readonly SessionHistoryItem[]): void {
    this.historyCountEl.textContent = `Historial reciente (${items.length})`;
    this.clearHistoryBtn.hidden = items.length === 0;
    this.historyListEl.innerHTML = '';

    if (items.length === 0) {
      this.historyListEl.innerHTML =
        '<p class="rv-history-empty">Presiona el botón rojo para abrir un video aleatorio en YouTube.</p>';
      return;
    }

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'rv-history-item';

      const info = document.createElement('div');
      info.className = 'rv-history-info';

      const title = document.createElement('strong');
      title.className = 'rv-history-title';
      title.textContent = item.clip.video.title;

      const meta = document.createElement('span');
      meta.className = 'rv-history-meta';
      meta.textContent = `${item.clip.formattedSlot} / ∞ • t=${formatDurationTimestamp(item.clip.startSeconds)}`;

      info.append(title, meta);

      const openLink = document.createElement('a');
      openLink.className = 'rv-mini-btn rv-mini-link';
      openLink.href = item.clip.watchUrl;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      openLink.textContent = 'Abrir ↗';

      row.append(info, openLink);
      this.historyListEl.appendChild(row);
    }
  }

  public toggleMenu(forceState?: boolean): void {
    this.menuOpen = forceState ?? !this.menuOpen;
    this.menuDrawer.hidden = !this.menuOpen;
    this.menuBtn.classList.toggle('is-open', this.menuOpen);
    this.menuBtn.setAttribute('aria-expanded', String(this.menuOpen));
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onWindowKeyDown);
    document.removeEventListener('pointerdown', this.onDocumentPointerDown);
    if (this.pressVisualTimeout !== null) {
      window.clearTimeout(this.pressVisualTimeout);
    }
    this.root.remove();
  }
}
