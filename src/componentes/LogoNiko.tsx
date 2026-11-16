export function LogoNiko({ tamanho = 28, brilho }: { tamanho?: number; brilho?: boolean }) {
  const comBrilho = brilho ?? tamanho >= 48;
  return (
    <img
      src="/apple-touch-icon.png"
      width={tamanho}
      height={tamanho}
      alt="Kyro"
      style={{
        width: `${tamanho}px`,
        height: `${tamanho}px`,
        borderRadius: "22%",
        objectFit: "contain",
        display: "block",
        flex: "0 0 auto",
        filter: comBrilho ? "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.12))" : undefined,
      }}
    />
  );
}
