import { loadMoves } from './moves.js'

let dataPromise

async function readJson(name) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`)
  if (!response.ok) throw new Error(`宝可梦数据加载失败（HTTP ${response.status}），请重试`)
  return response.json()
}

export function loadPokemonData() {
  if (!dataPromise) {
    dataPromise = Promise.all([readJson('pokemon'), readJson('pokemon-rules'), loadMoves()])
      .then(([catalog, rules, moves]) => ({ ...catalog, rules, moves }))
      .catch(error => {
        dataPromise = null
        throw error
      })
  }
  return dataPromise
}
