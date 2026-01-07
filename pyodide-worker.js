let pyodideReadyPromise = null;

async function initPyodide(indexURL) {
  if (pyodideReadyPromise) return pyodideReadyPromise;

  pyodideReadyPromise = (async () => {
    importScripts(`${indexURL}pyodide.js`);
    const pyodide = await self.loadPyodide({ indexURL });
    return pyodide;
  })();

  return pyodideReadyPromise;
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== "run") return;

  try {
    const pyodide = await initPyodide(data.indexURL);
    const logs = [];
    pyodide.setStdout({ batched: (msg) => logs.push(msg) });
    pyodide.setStderr({ batched: (msg) => logs.push(`Erro: ${msg}`) });
    await pyodide.runPythonAsync(data.code);

    self.postMessage({
      type: "result",
      id: data.id,
      output: logs.length ? logs.join("\n") : "> Código executado sem saída.",
    });
  } catch (error) {
    self.postMessage({
      type: "result",
      id: data.id,
      error: String(error),
    });
  }
};
