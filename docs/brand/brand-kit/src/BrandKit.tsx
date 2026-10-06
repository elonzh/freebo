import { useState } from "react";
import { ArrowDownToLine, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
const files = (path: string) => "./" + path;
const examples = [
  {
    title: "Primary lockup",
    name: "logo",
    dark: false,
    description: "Full-color mark with the Atma 600 wordmark.",
  },
  {
    title: "On pine",
    name: "logo-on-dark",
    dark: true,
    description: "Use the light wordmark on a deep pine surface.",
  },
  {
    title: "Single ink",
    name: "logo-mono",
    dark: false,
    description: "A true one-color mark with transparent facial cutouts.",
  },
  {
    title: "Reversed",
    name: "logo-white",
    dark: true,
    description: "White-only artwork for dark surfaces and print.",
  },
  {
    title: "Stacked",
    name: "logo-stacked",
    dark: false,
    description: "A compact vertical alternative.",
  },
  {
    title: "Stacked on pine",
    name: "logo-stacked-on-dark",
    dark: true,
    description: "Preserves the same type and mark proportions.",
  },
];
export function BrandKit() {
  const [copied, setCopied] = useState("");
  return (
    <div className="brand-kit">
      <header className="kit-header">
        <a href="./brand.html" aria-label="Freebo Brand Kit">
          <img src={files("svg/logo-on-dark.svg")} alt="Freebo" />
        </a>
        <span>Brand assets</span>
        <nav>
          <Button asChild>
            <a href={files("Freebo-brand-kit.zip")} download>
              <ArrowDownToLine />
              Download kit
            </a>
          </Button>
        </nav>
      </header>
      <main>
        <section className="kit-intro">
          <div className="kit-signature">
            <img src={files("svg/logo-on-dark.svg")} alt="Freebo" />
          </div>
          <div>
            <h1>
              A friendly face.
              <br />A name with character.
            </h1>
            <p>
              The guide dog and Atma SemiBold give Freebo its identity. Deep pine keeps it
              comfortable; lime brings it to life.
            </p>
            <p className="kit-choice">Atma · 600 · -0.015 em</p>
            <Button variant="outline" asChild>
              <a href={files("Freebo-brand-guide.pdf")} download>
                Brand guide <ArrowDownToLine />
              </a>
            </Button>
          </div>
        </section>
        <section className="kit-section">
          <div className="kit-section-head">
            <h2>The logo family</h2>
            <p>One identity, ready for different surfaces.</p>
          </div>
          <div className="kit-logos">
            {examples.map((item) => (
              <article key={item.name}>
                <div className={"kit-logo-stage" + (item.dark ? " pine" : "")}>
                  <img src={files("svg/" + item.name + ".svg")} alt={"Freebo — " + item.title} />
                </div>
                <div className="kit-asset-title">
                  <h3>{item.title}</h3>
                  <div>
                    <a href={files("svg/" + item.name + ".svg")} download>
                      SVG
                    </a>
                    <a href={files("png/" + item.name + ".png")} download>
                      PNG
                    </a>
                  </div>
                </div>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="kit-section kit-foundations">
          <div>
            <h2>Color that feels like Freebo</h2>
            <p>Pine for structure, lime for energy, paper for space.</p>
            <div className="kit-palettes">
              {[
                { name: "Pine", hex: "#193C35" },
                { name: "Lime", hex: "#BDE64D" },
                { name: "Paper", hex: "#FBFCF9" },
              ].map((color) => (
                <div key={color.name}>
                  <div style={{ background: color.hex }} />
                  <h3>{color.name}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(color.hex)
                        .then(() => setCopied(color.hex))
                        .catch(() => setCopied("Select the color code to copy"));
                    }}
                  >
                    {color.hex}
                    {copied === color.hex ? <Check /> : <Copy />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="kit-type">
            <h2>The name is Atma</h2>
            <img src={files("svg/wordmark-pine.svg")} alt="Freebo in Atma SemiBold" />
            <p>
              Atma SemiBold, weight 600, tracking -0.015 em. Keep Freebo capitalized in every
              locale. Use the system sans-serif for interface copy.
            </p>
            <div className="kit-type-links">
              <Button variant="outline" asChild>
                <a href={files("fonts/Atma-SemiBold.ttf")} download>
                  Download font <ArrowDownToLine />
                </a>
              </Button>
              <a href={files("fonts/OFL.txt")}>SIL OFL 1.1</a>
              <a href={files("source/logo-editable.svg")} download>
                Editable source
              </a>
            </div>
          </div>
        </section>
        <section className="kit-section">
          <div className="kit-section-head">
            <h2>A familiar companion on your desktop</h2>
            <p>App icons from 16 to 1024px, plus ICO and ICNS.</p>
          </div>
          <div className="kit-icon-sizes">
            {[16, 24, 32, 48, 64, 128, 256].map((size) => (
              <div key={size}>
                <img
                  src={files("icons/icon-" + size + ".png")}
                  width={size}
                  height={size}
                  alt={"Freebo icon " + size + "px"}
                />
                <span>{size}px</span>
              </div>
            ))}
          </div>
          <div className="kit-downloads">
            <Button variant="outline" asChild>
              <a href={files("icons/icon.ico")} download>
                Windows ICO <ArrowDownToLine />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={files("icons/icon.icns")} download>
                macOS ICNS <ArrowDownToLine />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={files("icons/icon-1024.png")} download>
                1024px PNG <ArrowDownToLine />
              </a>
            </Button>
          </div>
        </section>
        <section className="kit-section">
          <div className="kit-section-head">
            <h2>Ready to share</h2>
            <p>Social covers, desktop backgrounds and a one-page guide.</p>
          </div>
          <div className="kit-sharing">
            <a href={files("social/social.png")} download>
              <img src={files("social/social.png")} alt="Freebo social cover" />
              <span>
                Social cover · 1280 × 640 <ArrowDownToLine size={15} />
              </span>
            </a>
            <a href={files("social/cover-16x9.png")} download>
              <img src={files("social/cover-16x9.png")} alt="Freebo widescreen cover" />
              <span>
                Widescreen cover · 1600 × 900 <ArrowDownToLine size={15} />
              </span>
            </a>
          </div>
          <div className="kit-downloads">
            <a href={files("wallpapers/wallpaper-pine.png")} download>
              Pine wallpaper
            </a>
            <a href={files("wallpapers/wallpaper-paper.png")} download>
              Paper wallpaper
            </a>
            <a href={files("Freebo-brand-guide.pdf")} download>
              Brand guide PDF
            </a>
          </div>
        </section>
        <section className="kit-rules">
          <h2>Keep the companion recognizable.</h2>
          <div>
            <p>
              Use the supplied lockups with their original proportions. Leave at least one quarter
              of the dog-head height clear around the logo.
            </p>
            <p>
              Use the logo at 120px or wider and the standalone mark at 24px or larger. At 16px, use
              the dedicated app icon.
            </p>
            <p>
              Keep the asymmetric ears and friendly expression. Avoid stretching, blur, extra colors
              or the Chinese nickname in brand assets.
            </p>
          </div>
        </section>
      </main>
      <footer className="kit-footer">
        <img src={files("svg/wordmark-pine.svg")} alt="Freebo" />
        <p>
          Freebo brand assets · Atma under SIL OFL 1.1 · Vector masters and reproducible exports
          included.
        </p>
        <a href={files("manifest.json")}>File manifest</a>
      </footer>
      <span className="sr-only" role="status">
        {copied ? "Copied " + copied : ""}
      </span>
    </div>
  );
}
