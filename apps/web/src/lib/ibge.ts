export interface Municipio {
  id: string
  nome: string
  uf: string
}

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades'

export async function fetchMunicipiosByUfs(ufs: string[]): Promise<Municipio[]> {
  if (ufs.length === 0) return []

  const results = await Promise.all(
    ufs.map(async (uf) => {
      try {
        const res = await fetch(`${IBGE_BASE}/estados/${uf}/municipios?orderBy=nome`)
        if (!res.ok) return []
        const data = (await res.json()) as Array<{ id: number; nome: string }>
        return data.map(m => ({ id: String(m.id), nome: m.nome, uf }))
      } catch {
        return []
      }
    })
  )

  return results.flat()
}
