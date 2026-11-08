// Pure rule evaluation, shared by the UI and the offline regression tests.
export function normalizeSearch(value) {
  return String(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase()
}

export const METHOD_LABELS = {
  1: '升级 / 回忆', 2: '遗传', 3: '招式教学', 4: '招式学习器',
  6: '携带电气球遗传', 10: '形态变化', 11: '基格尔德多面体', 12: '训练',
}

export function moveLevels(move) {
  return [0, ...Array.from({ length: 12 }, (_, i) => i + 1)]
    .filter(level => move[level === 0 ? 'cantrip' : `level_${level}`])
}

export function racialMaxLevel(level) {
  return Math.floor(Math.max(1, Number(level) || 1) / 20) + 1
}

function allowsGender(pokemon, gender) {
  if (!gender || gender === 'unknown') return true
  if (gender === 'female') return pokemon.gender_rate > 0
  if (gender === 'male') return pokemon.gender_rate >= 0 && pokemon.gender_rate < 8
  return pokemon.gender_rate === -1
}

export function learningSources(pokemon, catalog, edges, { gender = 'unknown', includeEvolution = true } = {}) {
  const byId = new Map(catalog.map(p => [p.id, p]))
  const descendants = []
  const ancestors = []
  if (includeEvolution) {
    let current = pokemon.id
    const visited = new Set([current])
    while (true) {
      const next = [...new Set(edges.filter(([from, to, requiredGender]) =>
        from === current && byId.has(to) && allowsGender(byId.get(to), gender) &&
        (!requiredGender || gender === 'unknown' ||
          requiredGender === ({ female: 1, male: 2, genderless: 3 })[gender]))
        .map(([, to]) => to))]
      // Don't choose a branch for the player, including regional branches.
      if (next.length !== 1 || visited.has(next[0])) break
      current = next[0]
      visited.add(current)
      descendants.push(byId.get(current))
    }
    const queue = [pokemon.id]
    const seen = new Set(queue)
    while (queue.length) {
      const currentId = queue.shift()
      for (const [from, to] of edges) {
        if (to !== currentId || seen.has(from) || !byId.has(from)) continue
        seen.add(from)
        ancestors.push(byId.get(from))
        queue.push(from)
      }
    }
  }
  return { levelUp: [pokemon, ...descendants], teaching: [pokemon, ...descendants, ...ancestors], descendants, ancestors }
}

export function buildLearnset(data, pokemonId, options = {}) {
  const pokemon = data.pokemon.find(p => p.id === pokemonId)
  if (!pokemon) throw new Error('请选择宝可梦')
  const sources = learningSources(pokemon, data.pokemon, data.rules.evolutions, options)
  const moveMap = new Map(data.moves.map(m => [m.name, m]))
  const typeCantrips = new Set(Object.values(data.rules.cantrips).flat())
  const buckets = { levelUp: new Map(), machine: new Map(), other: new Map(), compensation: new Map() }
  const unresolved = new Map()
  const levelSourceIds = new Set(sources.levelUp.map(p => p.id))

  function add(bucket, name, source) {
    const move = moveMap.get(name)
    if (!move) return
    let row = buckets[bucket].get(name)
    if (!row) {
      const levels = moveLevels(move)
      row = { ...move,
        cantrip: move.cantrip || (!levels.length && typeCantrips.has(name) ? data.rules.notes?.[name] || '' : ''),
        learning_sources: [], available_levels: levels.length ? levels : typeCantrips.has(name) ? [0] : [],
        merged_from: data.rules.merged[name] || [], rule_note: data.rules.notes?.[name] || '' }
      buckets[bucket].set(name, row)
    }
    row.learning_sources.push(source)
  }

  for (const source of sources.teaching) {
    for (const [moveId, method, originalLevel, versions] of source.moves) {
      const mapping = data.rules.move_map[moveId]
      const provenance = { pokemon_id: source.id, pokemon: source.name, generation: source.generation,
        original: mapping?.name || `#${moveId}`, method: METHOD_LABELS[method] || String(method),
        original_level: originalLevel, versions }
      const bucket = method === 1 && levelSourceIds.has(source.id) ? 'levelUp'
        : method === 4 ? 'machine' : 'other'
      if (!mapping?.rule || !moveMap.has(mapping.rule)) {
        const key = `${moveId}:${source.id}:${method}`
        unresolved.set(key, provenance)
        continue
      }
      add(bucket, mapping.rule, provenance)
      if (method === 1 && levelSourceIds.has(source.id) && mapping.rule === '重踏') {
        add('levelUp', '地震', { ...provenance, method: '手册：升级重踏可学地震' })
      }
    }
  }

  // User-requested convention: type basics and original type cantrips are
  // presented in the machine list, explicitly labelled with their rule source.
  for (const source of sources.teaching) {
    for (const type of [...(source.id === pokemon.id ? ['任意'] : []), ...source.types]) {
      for (const name of data.rules.basic[type] || []) {
        add('machine', name, { pokemon_id: source.id, pokemon: source.name,
          original: name, method: `${type}属性基本招式`, versions: [] })
      }
      for (const name of data.rules.cantrips[type] || []) {
        add('machine', name, { pokemon_id: source.id, pokemon: source.name,
          original: name, method: `${type}属性种族戏法`, versions: [] })
      }
    }
  }
  if (pokemon.species_id === 133) {
    for (const type of ['火', '水', '草', '电', '超能力', '冰', '恶', '妖精']) {
      for (const name of data.rules.basic[type] || []) {
        add('compensation', name, { pokemon_id: pokemon.id, pokemon: pokemon.name,
          original: name, method: `伊布补偿：${type}属性（合计最多选 4 个）`, versions: [] })
      }
    }
  }

  const result = Object.fromEntries(Object.entries(buckets).map(([key, bucket]) => [key,
    [...bucket.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))]))
  return { ...result, pokemon, sources, unresolved: [...unresolved.values()],
    missingSources: sources.teaching.filter(p => !p.moves.length) }
}
