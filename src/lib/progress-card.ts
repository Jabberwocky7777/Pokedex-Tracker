/**
 * The shareable progress card: an image drawn on a canvas in the browser —
 * completion per dex and the sprites of what is caught. Nothing is uploaded;
 * the picture exists only on the device until the user saves or shares it.
 *
 * The layout is worked out by a pure function (tested); drawing takes the
 * layout and a 2D context.
 */

export interface CardDex {
  name: string;
  caught: number;
  total: number;
}

export interface CardData {
  title: string;
  /** The generation's own count comes first, then its regional dexes */
  dexes: CardDex[];
  /** Sprite URLs of the caught Pokémon, in dex order */
  sprites: string[];
  date: string;
}

export const CARD_WIDTH = 1080;
const MARGIN = 56;
const HEADER = 250;
const DEX_ROW = 58;
const SPRITE = 64;
const GAP = 4;
const FOOTER = 70;

export interface CardLayout {
  width: number;
  height: number;
  dexTop: number;
  gridTop: number;
  columns: number;
  /** Top-left corner of each sprite */
  sprites: { x: number; y: number }[];
}

export const percent = (dex: CardDex) => (dex.total > 0 ? Math.floor((dex.caught / dex.total) * 100) : 0);

export function cardLayout(dexCount: number, spriteCount: number): CardLayout {
  const columns = Math.floor((CARD_WIDTH - 2 * MARGIN + GAP) / (SPRITE + GAP));
  // Centre the grid in the space the margins leave
  const left = Math.round((CARD_WIDTH - (columns * (SPRITE + GAP) - GAP)) / 2);
  const dexTop = HEADER;
  const gridTop = dexTop + dexCount * DEX_ROW + 30;
  const rows = Math.ceil(spriteCount / columns);
  return {
    width: CARD_WIDTH,
    height: gridTop + rows * (SPRITE + GAP) + FOOTER,
    dexTop, gridTop, columns,
    sprites: Array.from({ length: spriteCount }, (_, i) => ({
      x: left + (i % columns) * (SPRITE + GAP),
      y: gridTop + Math.floor(i / columns) * (SPRITE + GAP),
    })),
  };
}

const COLORS = { background: "#030712", panel: "#111827", track: "#1f2937", bar: "#6366f1", done: "#22c55e", text: "#f3f4f6", muted: "#9ca3af" };

/** Draws the card. `images[i]` is the loaded sprite for `data.sprites[i]`, or null where it couldn't be loaded. */
export function drawCard(ctx: CanvasRenderingContext2D, data: CardData, layout: CardLayout, images: (CanvasImageSource | null)[]): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const main = data.dexes[0];
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText(data.title, MARGIN, 80);
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 104px system-ui, sans-serif";
  ctx.fillText(`${percent(main)}%`, MARGIN, 190);
  const afterPercent = MARGIN + ctx.measureText(`${percent(main)}%`).width + 28;
  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.fillText(`${main.caught} / ${main.total} caught`, afterPercent, 186);

  // One bar per dex
  ctx.font = "500 28px system-ui, sans-serif";
  data.dexes.forEach((dex, i) => {
    const y = layout.dexTop + i * DEX_ROW;
    const barLeft = MARGIN + 330, barWidth = layout.width - MARGIN - barLeft - 190;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(dex.name, MARGIN, y + 30);
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(barLeft, y + 10, barWidth, 22);
    ctx.fillStyle = dex.total > 0 && dex.caught >= dex.total ? COLORS.done : COLORS.bar;
    ctx.fillRect(barLeft, y + 10, dex.total > 0 ? Math.round((dex.caught / dex.total) * barWidth) : 0, 22);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right";
    ctx.fillText(`${dex.caught}/${dex.total} · ${percent(dex)}%`, layout.width - MARGIN, y + 30);
    ctx.textAlign = "left";
  });

  // The sprites, pixel-sharp
  ctx.imageSmoothingEnabled = false;
  layout.sprites.forEach(({ x, y }, i) => {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, SPRITE, SPRITE);
    const image = images[i];
    if (image) ctx.drawImage(image, x, y, SPRITE, SPRITE);
  });
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText(`Pokédex Tracker · ${data.date}`, MARGIN, layout.height - 28);
}
