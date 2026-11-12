export default function Carregando() {
  return (
    <div className="animate-pulse space-y-6 p-6" aria-label="Carregando">
      <div className="mx-auto h-48 max-w-5xl rounded-3xl bg-painel" />
      <div className="mx-auto h-8 max-w-md rounded-xl bg-painel" />
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-painel" />)}
      </div>
    </div>
  );
}
