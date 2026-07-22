import { parseAml } from "@covaga/e3d-core/aml";

/*
 * Worker de parseo del AutomationML: recibe los bytes del .aml, decodifica y
 * parsea fuera del hilo principal (el fichero puede superar los 30 MB) y
 * devuelve la estructura AmlProject por structured clone.
 */
self.onmessage = (event: MessageEvent<Uint8Array>) => {
  try {
    const xml = new TextDecoder("utf-8").decode(event.data);
    self.postMessage({ ok: true, project: parseAml(xml) });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
