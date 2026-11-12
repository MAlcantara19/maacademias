// Aparece na hora em que você toca num menu, enquanto a página carrega
export default function Carregando() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Carregando">
      <div className="h-10 w-2/3 rounded-xl bg-painel" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-painel" />)}
      </div>
      <div className="h-40 rounded-2xl bg-painel" />
      <div className="h-28 rounded-2xl bg-painel" />
    </div>
  );
}
