const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronSMART", {
  getRealDrives: () => ipcRenderer.invoke("smart:get-drives"),
  windowControl: (action) => ipcRenderer.send("window:control", action),
});
