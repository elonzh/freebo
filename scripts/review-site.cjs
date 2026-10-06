// Local review viewer: operate it through the UI; export the full document with Cmd/Ctrl+Shift+S.
const { app, BrowserWindow, Menu } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
void app.whenReady().then(async () => {
  const url = new URL(process.argv[2]);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("Review only local development pages.");
  const width = Number(process.argv[3] ?? 1440),
    height = Number(process.argv[4] ?? 900);
  const window = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    title: `Site review ${width}`,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Review",
        submenu: [
          {
            label: "Save full-page screenshot",
            accelerator: "CmdOrCtrl+Shift+S",
            click: async () => {
              const directory = process.env.FREEBO_CAPTURE_DIR;
              if (!directory) throw new Error("Set FREEBO_CAPTURE_DIR for exports.");
              window.webContents.debugger.attach("1.3");
              try {
                const metrics =
                  await window.webContents.debugger.sendCommand("Page.getLayoutMetrics");
                const { data } = await window.webContents.debugger.sendCommand(
                  "Page.captureScreenshot",
                  {
                    format: "png",
                    captureBeyondViewport: true,
                    clip: {
                      x: 0,
                      y: 0,
                      width: metrics.cssContentSize.width,
                      height: metrics.cssContentSize.height,
                      scale: 1,
                    },
                  },
                );
                await mkdir(directory, { recursive: true });
                const file = path.join(directory, `site-${width}-${Date.now()}.png`);
                await writeFile(file, Buffer.from(data, "base64"));
                console.log(`Saved ${file}`);
              } finally {
                window.webContents.debugger.detach();
              }
            },
          },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
  await window.loadURL(url.toString());
});
app.on("window-all-closed", () => app.quit());
