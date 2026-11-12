const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const dev = path.join(__dirname, "..", "web", "index.html");
const packed = path.join(__dirname, "web", "index.html");

function createWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 920,
    minWidth: 360,
    minHeight: 620,
    backgroundColor: "#070b10",
    autoHideMenuBar: true,
    title: "Flok",
    icon: path.join(__dirname, "icon.png"),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadFile(fs.existsSync(packed) ? packed : dev);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
