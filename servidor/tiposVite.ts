import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server as HttpServer } from "node:http";

export namespace Connect {
  export type NextHandleFunction = (req: IncomingMessage, res: ServerResponse, proximo: (erro?: unknown) => void) => unknown;
}

export interface Plugin {
  name: string;
  configureServer?: (servidor: { middlewares: { use: (fn: Connect.NextHandleFunction) => void }; httpServer?: HttpServer | null }) => void;
  configurePreviewServer?: (servidor: { middlewares: { use: (fn: Connect.NextHandleFunction) => void }; httpServer?: HttpServer | null }) => void;
  transformIndexHtml?: { order?: "pre" | "post"; handler: (html: string, contexto: { server?: unknown }) => string };
}
