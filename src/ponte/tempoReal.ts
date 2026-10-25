let endpoint: string | null = null;

export function definirEndpointTempoReal(valor: string | null) {
  endpoint = valor;
}

export function endpointTempoReal(): string | null {
  return endpoint;
}
