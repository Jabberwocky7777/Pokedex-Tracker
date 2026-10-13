import { useRef, useState } from "react";
import { cardLayout, drawCard, type CardData } from "../../lib/progress-card";

interface Props {
  /** Built when the button is pressed, so the card shows the marks as they are then */
  getData: () => CardData;
}

const FILE_NAME = "pokedex-progress.png";

/** Loads a sprite so that a canvas it is drawn on can still be exported (the sprite host allows cross-origin use). */
function loadSprite(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);   // offline and never seen: the card shows an empty tile
    image.src = url;
  });
}

async function loadAll(urls: string[], atOnce = 12): Promise<(HTMLImageElement | null)[]> {
  const images: (HTMLImageElement | null)[] = new Array(urls.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(atOnce, urls.length) }, async () => {
    while (next < urls.length) {
      const i = next++;
      images[i] = await loadSprite(urls[i]);
    }
  }));
  return images;
}

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

/**
 * The shareable progress card. The image is drawn in this browser and stays
 * on this device: saving and sharing hand it to the device, not to a server.
 */
export default function ShareCard({ getData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "drawing" | "ready">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  async function create() {
    setState("drawing");
    setMessage(null);
    const data = getData();
    const images = await loadAll(data.sprites);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { setState("idle"); setMessage("This browser can't draw the image."); return; }
    const layout = cardLayout(data.dexes.length, data.sprites.length);
    canvas.width = layout.width;
    canvas.height = layout.height;
    drawCard(ctx, data, layout, images);
    const missing = images.filter((image) => image === null).length;
    if (missing > 0) setMessage(`${missing} sprite${missing === 1 ? "" : "s"} couldn't be loaded (no connection?) and show as empty tiles.`);
    // The share sheet is only offered where the device can share an image file
    const probe = new File([new Blob()], FILE_NAME, { type: "image/png" });
    setCanShare(typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    setState("ready");
  }

  async function download() {
    const blob = canvasRef.current && await toBlob(canvasRef.current);
    if (!blob) { setMessage("Couldn't make the image file."); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    const blob = canvasRef.current && await toBlob(canvasRef.current);
    if (!blob) { setMessage("Couldn't make the image file."); return; }
    try {
      await navigator.share({ files: [new File([blob], FILE_NAME, { type: "image/png" })], title: "My Pokédex progress" });
    } catch (err) {
      // Closing the share sheet is not an error
      if (!(err instanceof DOMException && err.name === "AbortError")) setMessage("Sharing didn't work here — use Download instead.");
    }
  }

  const button = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
  return (
    <section className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-3" data-testid="share-card">
      <div>
        <h3 className="text-sm font-semibold text-gray-100">Progress card</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          A picture of your progress — completion per dex and everything you&apos;ve caught — made on this device. Nothing is uploaded.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={create} disabled={state === "drawing"} className={`${button} bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50`}>
          {state === "drawing" ? "Drawing…" : state === "ready" ? "Draw again" : "Create image"}
        </button>
        {state === "ready" && (
          <>
            <button onClick={download} className={`${button} bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200`}>Download</button>
            {canShare && <button onClick={share} className={`${button} bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200`}>Share…</button>}
          </>
        )}
      </div>
      {message && <p role="status" className="text-xs text-amber-300">{message}</p>}
      {/* The canvas itself is the preview: nothing is turned into an image URL until it is saved or shared */}
      <canvas
        ref={canvasRef}
        aria-label="Progress card preview"
        className={`w-full h-auto rounded-lg border border-gray-800 ${state === "ready" ? "" : "hidden"}`}
      />
    </section>
  );
}
