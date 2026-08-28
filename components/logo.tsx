import Image from "next/image";
import mark from "@/assets/logo-mark.png";

/**
 * The EXSAVERSE mark on its brand tile.
 *
 * The mark is a dark grey gradient, so it cannot sit bare on an app surface:
 * against the dark theme's `--card` (#14141b) its own tones (#333-#666) land at
 * roughly 1.5:1 to 3.3:1 and it disappears. The amber tile is what makes it
 * legible in both themes - the plate carries the contrast, so the mark does not
 * have to. That is also how the artwork was supplied: a dark mark on a warm
 * ground.
 *
 * `assets/logo-mark-light.png` is the variant for placing the mark directly on
 * a dark surface with no tile behind it.
 */
export function Logo({
  size = 28,
  className = "",
}: {
  /** Tile edge in px. The mark is inset to about two thirds of it. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-md bg-accent ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={mark}
        alt=""
        aria-hidden
        // Height-constrained: the mark is taller than it is wide.
        style={{ height: Math.round(size * 0.62), width: "auto" }}
        priority
      />
    </span>
  );
}
