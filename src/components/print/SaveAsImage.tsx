import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { saveFiles, SAVES_BY_SHARING } from "../../lib/save-file";
import { drawPage, IMAGE_WIDTH, pageHeightOf, type ImageHeader, type ImageLine } from "../../lib/next-image";

interface Props {
  /** Built when the button is pressed, so the images show the marks as they are then */
  getPages: () => { pages: ImageLine[][]; header: ImageHeader };
  /** File names are `<fileStem>-1.png`, `-2.png`, … */
  fileStem: string;
}

interface Made {
  files: File[];
  /** data: URLs for the previews — the CSP allows data: images, and a press-and-hold on one saves it on iOS */
  previews: string[];
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

/**
 * "Save as image" in a print panel: the sheet drawn as phone-sized pictures,
 * for the share sheet (Save Image on an iPhone) or a download. Drawn in this
 * browser and kept on this device.
 */
export default function SaveAsImage({ getPages, fileStem }: Props) {
  const [state, setState] = useState<"idle" | "drawing" | "ready">("idle");
  const [made, setMade] = useState<Made | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    setState("drawing");
    setMessage(null);
    const { pages, header } = getPages();
    const files: File[] = [];
    const previews: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = IMAGE_WIDTH;
      canvas.height = pageHeightOf(pages[i]);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setState("idle");
        setMessage("This browser can't draw the image.");
        return;
      }
      drawPage(ctx, pages[i], header, i + 1, pages.length);
      const blob = await toBlob(canvas);
      if (!blob) {
        setState("idle");
        setMessage("Couldn't make the image file.");
        return;
      }
      files.push(
        new File([blob], pages.length === 1 ? `${fileStem}.png` : `${fileStem}-${i + 1}.png`, { type: "image/png" }),
      );
      previews.push(canvas.toDataURL("image/png"));
    }
    setMade({ files, previews });
    setState("ready");
  }

  // Files are made beforehand, so the share sheet opens straight from the tap (Safari needs that)
  // The iOS app shares through its own plugin, which works whether or not the web view has navigator.share
  const canShare =
    !!made &&
    (SAVES_BY_SHARING ||
      (typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: made.files })));

  async function share() {
    if (!made) return;
    try {
      if (SAVES_BY_SHARING) await saveFiles(made.files);
      else await navigator.share({ files: made.files });
    } catch (err) {
      // Closing the share sheet is not an error
      if (!(err instanceof DOMException && err.name === "AbortError"))
        setMessage("Sharing didn't work here — press and hold an image to save it.");
    }
  }

  function download() {
    if (made) void saveFiles(made.files);
  }

  const button =
    "flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium disabled:opacity-40";
  return (
    <div className="flex flex-col gap-2 border-t border-gray-800 pt-3" data-testid="save-as-image">
      {state !== "ready" ? (
        <button onClick={create} disabled={state === "drawing"} className={`${button} self-start`}>
          <ImageIcon size={15} aria-hidden="true" />
          {state === "drawing" ? "Drawing…" : "Save as image"}
        </button>
      ) : (
        made && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {canShare && (
                <button
                  onClick={share}
                  className={`${button} bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white`}
                >
                  {made.files.length === 1 ? "Save or share…" : `Save or share ${made.files.length} images…`}
                </button>
              )}
              {!SAVES_BY_SHARING && (
                <button onClick={download} className={button}>
                  Download
                </button>
              )}
              <button
                onClick={() => {
                  setMade(null);
                  setState("idle");
                }}
                className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-100"
              >
                Redo
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {canShare
                ? "Choose Save Image in the share sheet to put it in Photos."
                : "Press and hold an image to save it."}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {made.previews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Page ${i + 1} of ${made.previews.length}`}
                  className="h-48 w-auto rounded-md border border-gray-800 flex-shrink-0"
                />
              ))}
            </div>
          </>
        )
      )}
      {message && (
        <p className="text-xs text-amber-300" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
