import { runProject } from "../src/core.mjs";
self.onmessage = (event) => {
  try {
    self.postMessage({ ok: true, report: runProject(event.data) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: (error.code ? error.code + ": " : "") + error.message,
    });
  }
};
