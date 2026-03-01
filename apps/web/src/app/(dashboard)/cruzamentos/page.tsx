export default function CruzamentosPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cruzamentos</h1>
          <p className="mt-1 text-gray-600">
            Análise de aderência das CATs aos requisitos dos editais
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">
            Nenhum cruzamento realizado. Acesse um edital e inicie a análise de aderência.
          </p>
        </div>
      </div>
    </div>
  )
}
