import { createServer } from "node:http";
import { instalarSincroniaTempoReal } from "../servidor/sincroniaTempoReal.js";

const servidor = createServer();
instalarSincroniaTempoReal(servidor);

export const config = { maxDuration: 300 };

export default servidor;
