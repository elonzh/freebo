// Render the dedicated small-size vector with the same Chromium engine as the app.
const { app, BrowserWindow } = require("electron");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..", "..");
app.setPath("userData", path.join(root, "artifacts/private/tray-render-profile"));

app
  .whenReady()
  .then(async () => {
    const directory = path.join(root, "resources/tray");
    const source = await readFile(path.join(directory, "mark.svg"), "utf8");
    // macOS colors opaque pixels itself. Reverse the face mask, then keep the ears
    // and jaw visible with an outline rather than turning the fur into a solid blob.
    const template = source
      .replace(/<mask\b[^>]*>[\s\S]*?<\/mask>/, (mask) =>
        mask.replace(
          /(fill|stroke)="(black|white)"/g,
          (_, attribute, color) => `${attribute}="${color === "black" ? "white" : "black"}"`,
        ),
      )
      .replace(
        "</svg>",
        '<use href="#head" fill="none" stroke="black" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      );
    const window = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    await window.loadURL("data:text/html,<html><body></body></html>");
    for (const [name, svg] of [
      ["trayTemplate", template],
      [
        "trayColor",
        source
          .replace('fill="black" mask=', 'fill="#193C35" mask=')
          .replace("<defs>", '<rect width="20" height="20" rx="5" fill="#BDE64D"/><defs>'),
      ],
    ]) {
      for (const scale of [1, 2]) {
        const data = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
        const png = await window.webContents.executeJavaScript(`(async () => {
        const image = new Image(); image.src = ${JSON.stringify(data)}; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = ${20 * scale};
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png").split(",")[1];
      })()`);
        await writeFile(
          path.join(directory, `${name}${scale === 2 ? "@2x" : ""}.png`),
          Buffer.from(png, "base64"),
        );
      }
    }
    console.log("Rendered Freebo tray icons at 20 and 40 pixels.");
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
