// Render brand vector exports with Electron's own Chromium engine.
const { app, BrowserWindow } = require("electron");
const { readFile, writeFile, mkdir, copyFile } = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(".");
app.setPath("userData", path.join(root, ".impeccable/review/brand-implementation/render-profile"));
app
  .whenReady()
  .then(async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "assets/brand/freebo/brand.json"), "utf8"),
    );
    const window = new BrowserWindow({
      show: false,
      width: 1600,
      height: 900,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    await window.loadURL("data:text/html,<html><body></body></html>");
    for (const job of manifest.rasterJobs) {
      const svg = await readFile(path.join(root, job.svg));
      const url = "data:image/svg+xml;base64," + svg.toString("base64");
      const png = await window.webContents.executeJavaScript(`(async () => {
      const image = new Image(); image.src = ${JSON.stringify(url)}; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = ${job.width}; canvas.height = ${job.height};
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png").split(",")[1];
    })()`);
      const target = path.join(root, job.output);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(png, "base64"));
    }
    for (const [source, target] of [
      ["assets/brand/freebo/icons/icon-1024.png", "resources/icon.png"],
      ["assets/brand/freebo/icons/app-icon.svg", "public/icon.svg"],
      ["assets/brand/freebo/icons/icon-512.png", "public/icon.png"],
      ["assets/brand/freebo/social/social.png", "docs/assets/social.png"],
      ["assets/brand/freebo/fonts/Atma-SemiBold.woff2", "public/fonts/Atma-SemiBold.woff2"],
      ["assets/brand/freebo/fonts/OFL.txt", "public/fonts/Atma-OFL.txt"],
      ["assets/brand/freebo/fonts/OFL.txt", "docs/licenses/Atma-OFL.txt"],
      ...["logo", "logo-on-dark"].map((name) => [
        "assets/brand/freebo/svg/" + name + ".svg",
        "public/brand/" + name + ".svg",
      ]),
    ]) {
      await mkdir(path.dirname(path.join(root, target)), { recursive: true });
      await copyFile(path.join(root, source), path.join(root, target));
    }
    const guide = path.join(root, "docs/brand/brand-kit/brand-guide.html");
    try {
      await window.loadFile(guide);
      await window.webContents.executeJavaScript("document.fonts.ready");
      const pdf = await window.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        landscape: true,
        preferCSSPageSize: true,
      });
      await writeFile(path.join(root, "assets/brand/freebo/Freebo-brand-guide.pdf"), pdf);
    } catch (error) {
      if (error.code !== "ERR_FILE_NOT_FOUND") throw error;
    }
    console.log("Rendered " + manifest.rasterJobs.length + " brand images and updated app copies.");
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
