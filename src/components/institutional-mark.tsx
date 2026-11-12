import Image from "next/image";
export function InstitutionalMark() {
  return (
    <Image
      src="/brand/escudo-colima-blanco.png"
      alt="Escudo del Estado de Colima"
      width={150}
      height={194}
      className="institutional-mark"
      priority
    />
  );
}
