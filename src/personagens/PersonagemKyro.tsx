type Props = { tamanho?: number; className?: string };

export const NOME_KYRO = "Kyro";
export const CARGO_KYRO = "Assistente pessoal";

export function PersonagemKyro({ tamanho = 34, className }: Props) {
  return (
    <img
      src="/personagens/kyro/ocioso.svg"
      width={tamanho}
      height={tamanho}
      alt=""
      draggable={false}
      decoding="async"
      className={`personagem-imagem${className ? ` ${className}` : ""}`}
    />
  );
}
