const { app, BrowserWindow } = require("electron");
const { writeFile } = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const output = path.resolve(".impeccable/review/brand-implementation");
app.setPath("userData", path.join(output, "kit-profile"));
app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      width: 1440,
      height: 1000,
      useContentSize: true,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const run = (code) => window.webContents.executeJavaScript(code, true);
    const errors = [];
    window.webContents.on("console-message", (event) => {
      if (event.level === "error") errors.push(event.message);
    });
    await window.loadURL("http://127.0.0.1:5186/brand.html");
    await run(`Promise.all([...document.images].map(image => image.decode()))`);
    await run(`document.fonts.load('600 42px "Freebo Atma"', "A friendly face.")`);
    const links = await run(
      `Promise.all([...document.querySelectorAll("a[download]")].map(async a => ({href:a.href,status:(await fetch(a.href,{method:"HEAD"})).status})))`,
    );
    assert(links.every((link) => link.status === 200));
    assert.equal(await run("document.documentElement.scrollWidth > innerWidth"), false);
    const fonts = await run(`document.fonts.check('600 42px "Freebo Atma"')`);
    assert(fonts);
    async function capture(file, full = false) {
      window.webContents.debugger.attach("1.3");
      try {
        const { cssContentSize } =
          await window.webContents.debugger.sendCommand("Page.getLayoutMetrics");
        const { data } = await window.webContents.debugger.sendCommand("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: full,
          ...(full
            ? {
                clip: {
                  x: 0,
                  y: 0,
                  width: cssContentSize.width,
                  height: cssContentSize.height,
                  scale: 1,
                },
              }
            : {}),
        });
        await writeFile(path.join(output, file), Buffer.from(data, "base64"));
      } finally {
        window.webContents.debugger.detach();
      }
    }
    await capture("kit-desktop.png");
    await capture("kit-desktop-full.png", true);
    window.setContentSize(390, 1000);
    await run("new Promise(resolve => setTimeout(resolve,150))");
    assert.equal(await run("document.documentElement.scrollWidth > innerWidth"), false);
    await capture("kit-mobile.png");
    await capture("kit-mobile-full.png", true);
    assert.deepEqual(errors, []);
    await writeFile(
      path.join(output, "kit-report.json"),
      JSON.stringify(
        { downloadLinks: links, fontLoaded: fonts, viewports: [1440, 390], errors },
        null,
        2,
      ),
    );
    console.log(
      "Brand kit verified: " + links.length + " downloads, Atma font, desktop/mobile, no errors.",
    );
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
