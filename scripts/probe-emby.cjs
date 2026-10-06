// Read public integration modules through a fresh browser session. No credentials.
const { app, BrowserWindow } = require("electron");
const { writeFile } = require("node:fs/promises");

void app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    if (!process.argv[2]) throw new Error("Pass the public Emby web URL as the first argument.");
    await window.loadURL(process.argv[2]);
    const urls = [
      "modules/common/playback/playbackmanager.js",
      "modules/common/playback/playbackactions.js",
      "modules/common/playback/playqueuemanager.js",
      "modules/apphost.js",
      "modules/browser.js",
      "modules/emby-apiclient/apiclient.js",
    ];
    for (const resource of urls) {
      const source = await window.webContents.executeJavaScript(
        `fetch(${JSON.stringify(resource)}).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })`,
      );
      await writeFile(`/tmp/efp-${resource.split("/").pop()}`, source);
      console.log(`${resource}: ${source.length} bytes`);
    }
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.quit();
  }
});
