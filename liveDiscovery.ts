import {CatalogVideo, ClipCategory} from './types';

interface DiscoveryBucket {
  qid: string;
  label: string;
  category: Exclude<ClipCategory, ClipCategory.ALL>;
}

const DISCOVERY_BUCKETS: readonly DiscoveryBucket[] = [
  {qid: 'Q7366', label: 'Música Internacional', category: ClipCategory.MUSIC},
  {qid: 'Q134556', label: 'Sencillos Musicales', category: ClipCategory.MUSIC},
  {qid: 'Q193977', label: 'Videos Musicales', category: ClipCategory.MUSIC},
  {qid: 'Q215380', label: 'Bandas y Artistas', category: ClipCategory.MUSIC},
  {qid: 'Q11424', label: 'Cine y Tráilers', category: ClipCategory.ART},
  {qid: 'Q202866', label: 'Cine de Animación', category: ClipCategory.ART},
  {qid: 'Q7889', label: 'Videojuegos', category: ClipCategory.INTERNET},
  {qid: 'Q5398426', label: 'Series y TV', category: ClipCategory.RETRO},
  {qid: 'Q1107', label: 'Anime', category: ClipCategory.ART},
  {qid: 'Q93204', label: 'Documentales', category: ClipCategory.SCIENCE},
  {qid: 'Q24856', label: 'Sagas y Cultura', category: ClipCategory.INTERNET},
  {qid: 'Q17537576', label: 'Obras Creativas', category: ClipCategory.NATURE},
];

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

interface SparqlBinding {
  yt?: {value?: string};
  itemLabel?: {value?: string};
}

interface SparqlResponse {
  results?: {
    bindings?: SparqlBinding[];
  };
}

/**
 * Descubre nuevos IDs reales de YouTube desde Wikidata (propiedad P1651) vía CORS
 * para expandir dinámicamente el catálogo de forma continua sin requerir API keys.
 * Nunca lanza errores hacia la UI si no hay red o si la consulta vence por tiempo.
 */
export class LiveVideoDiscovery {
  private bucketCursor = Math.floor(Math.random() * DISCOVERY_BUCKETS.length);
  private offsetSeed = 0;
  private inFlight = false;

  public async fetchBatch(limit = 45): Promise<CatalogVideo[]> {
    if (this.inFlight || typeof fetch !== 'function') return [];
    this.inFlight = true;

    const bucket =
      DISCOVERY_BUCKETS[this.bucketCursor % DISCOVERY_BUCKETS.length];
    this.bucketCursor += 1;
    if (this.bucketCursor % DISCOVERY_BUCKETS.length === 0) {
      this.offsetSeed += limit;
    }

    const offset = (this.offsetSeed % 240);
    const sparql = `
      SELECT ?yt ?itemLabel WHERE {
        {
          SELECT ?item ?yt WHERE {
            ?item wdt:P31 wd:${bucket.qid};
                  wdt:P1651 ?yt.
          }
          OFFSET ${offset}
          LIMIT ${limit}
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
      }
    `;

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 4500);

    try {
      const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
        sparql
      )}`;
      const res = await fetch(url, {
        headers: {Accept: 'application/sparql-results+json'},
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as SparqlResponse;
      const bindings = data?.results?.bindings ?? [];
      const parsed: CatalogVideo[] = [];

      for (const row of bindings) {
        const id = row.yt?.value?.trim() ?? '';
        const rawLabel = row.itemLabel?.value?.trim() ?? '';
        if (!YOUTUBE_ID_REGEX.test(id)) continue;
        // Evitar títulos que solo muestran el Q-id interno de Wikidata
        const cleanTitle =
          rawLabel && !/^Q\d+$/.test(rawLabel)
            ? rawLabel
            : `Video Descubierto (${id})`;

        parsed.push({
          id,
          title: cleanTitle,
          channel: `${bucket.label} • Red en Vivo`,
          category: bucket.category,
          durationSec: 210,
          year: 2026,
        });
      }

      return parsed;
    } catch {
      return [];
    } finally {
      globalThis.clearTimeout(timeoutId);
      this.inFlight = false;
    }
  }
}
