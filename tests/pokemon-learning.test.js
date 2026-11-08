import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildLearnset, learningSources, moveLevels, normalizeSearch, racialMaxLevel } from '../src/lib/pokemon-learning.js'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url)))
const data = { ...read('pokemon'), rules: read('pokemon-rules'), moves: read('moves') }
const pokemon = id => data.pokemon.find(p => p.id === id)
const names = rows => rows.map(row => row.name)
const sources = (id, gender = 'unknown') => learningSources(pokemon(id), data.pokemon, data.rules.evolutions, { gender })

test('a latest-generation pool never includes older generations or spinoffs', () => {
  for (const p of data.pokemon) {
    for (const [, method, , versions] of p.moves) {
      assert.ok([1, 2, 3, 4, 6, 10, 11, 12].includes(method))
      for (const id of versions) {
        const version = data.rules.versions[id]
        assert.equal(version.generation, p.generation, `${p.name}: ${version.identifier}`)
        assert.ok(!['colosseum', 'xd', 'champions'].includes(version.identifier))
      }
    }
  }
  assert.equal(pokemon(906).generation, 9)
  assert.equal(pokemon(10162).generation, 8) // Galarian Ponyta: don't impose Gen 9.
})

test('gender controls the Ralts branch; Eevee never inherits all evolutions', () => {
  assert.deepEqual(sources(280, 'female').descendants.map(p => p.species_id), [281, 282])
  assert.deepEqual(sources(280, 'male').descendants.map(p => p.species_id), [281])
  assert.deepEqual(sources(280).descendants.map(p => p.species_id), [281])
  assert.deepEqual(sources(133).descendants, [])
  assert.deepEqual(sources(906).descendants.map(p => p.species_id), [907, 908])
})

test('regional form paths stay separate from ordinary forms', () => {
  assert.deepEqual(sources(10162).descendants.map(p => p.id), [10163])
  assert.deepEqual(sources(10163).ancestors.map(p => p.id), [10162])
  assert.ok(!sources(10163).teaching.some(p => p.id === 77 || p.id === 78))
  assert.deepEqual(sources(52).descendants.map(p => p.id), [53])
  assert.ok(!sources(52).descendants.some(p => p.species_id === 863))
})

test('pre-evolutions contribute to teaching but not the evolved species level-up list', () => {
  const result = buildLearnset(data, 282, { gender: 'female' })
  assert.deepEqual(result.sources.ancestors.map(p => p.id), [281, 280])
  assert.ok(result.levelUp.every(row => row.learning_sources.every(s => s.pokemon_id === 282)))
  assert.ok(result.other.some(row => row.learning_sources.some(s => s.pokemon_id === 280)))
  const own = buildLearnset(data, 282, { includeEvolution: false })
  assert.deepEqual(own.sources.teaching.map(p => p.id), [282])
})

test('all combined moves, including “合并为本招式”, resolve to one canonical rule', () => {
  assert.equal(Object.keys(data.rules.merged).length, 11)
  for (const [canonical, originals] of Object.entries(data.rules.merged)) {
    for (const original of originals) {
      const mapping = Object.values(data.rules.move_map).find(m => m.name === original)
      if (mapping) assert.equal(mapping.rule, canonical, original)
    }
  }
  const cubone = buildLearnset(data, 104)
  assert.ok(names(cubone.levelUp).includes('骨棒召唤'))
  assert.equal(names(cubone.levelUp).filter(n => n === '骨棒召唤').length, 1)
  assert.ok(!names(cubone.levelUp).includes('骨棒乱打'))
  assert.equal(Object.values(data.rules.move_map).find(m => m.name === '攻击指令').rule, '虫群指令')
  assert.equal(Object.values(data.rules.move_map).find(m => m.name === '千箭齐发').rule, '地脉细胞')
  assert.equal(Object.values(data.rules.move_map).find(m => m.name === '无极光束').rule, '无极光束')
})

test('handbook type changes cover additions, replacements and qualified forms', () => {
  assert.deepEqual(pokemon(39).types, ['力场', '妖精'])
  assert.deepEqual(pokemon(10163).types, ['超能力', '光耀'])
  assert.deepEqual(pokemon(78).types, ['火'])
  assert.ok(pokemon(10162).types.includes('光耀'))
  assert.ok(pokemon(531).types.includes('光耀'))
  assert.ok(!pokemon(10069).types.includes('光耀')) // Mega Audino is excluded.
  assert.ok(pokemon(10057).types.includes('光耀')) // Mega Absol only.
  assert.ok(!pokemon(359).types.includes('光耀'))
  assert.ok(pokemon(10173).types.includes('黯蚀'))
  assert.ok(!pokemon(222).types.includes('黯蚀'))
  const jigglypuff = buildLearnset(data, 39)
  assert.ok(names(jigglypuff.machine).includes('力场护盾'))
  assert.ok(!names(jigglypuff.machine).includes('质量效应'))
  assert.ok(names(buildLearnset(data, 133).machine).includes('质量效应'))
})

test('universal basics, original type cantrips and merged basics have valid details', () => {
  const result = buildLearnset(data, 1)
  assert.ok(names(result.machine).includes('觉醒之箭'))
  assert.ok(names(result.machine).includes('叶绿光束'))
  assert.ok(!names(result.machine).includes('千变万花：传奇动作'))
  assert.ok(!names(result.machine).includes('雷神之锤'))
  assert.ok(names(buildLearnset(data, 104).machine).includes('骨棒召唤'))
  assert.ok(names(buildLearnset(data, 906).machine).includes('灾厄箭')) // Unique final evolution gains Dark.
  assert.ok(!names(buildLearnset(data, 906, { includeEvolution: false }).machine).includes('灾厄箭'))
  assert.ok(names(buildLearnset(data, 470).machine).includes('质量效应')) // Eevee ancestor's Normal basics.
  const actualNames = new Set(data.moves.map(m => m.name))
  for (const lists of [data.rules.basic, data.rules.cantrips]) {
    for (const list of Object.values(lists)) {
      for (const name of list) assert.ok(actualNames.has(name), name)
    }
  }
})

test('Eevee compensation is separate and disappears after evolution', () => {
  const eevee = buildLearnset(data, 133)
  assert.ok(names(eevee.compensation).includes('暗袭要害'))
  assert.ok(names(eevee.compensation).includes('嬉闹'))
  assert.ok(!names(eevee.machine).includes('暗袭要害'))
  assert.equal(buildLearnset(data, 700).compensation.length, 0)
})

test('a species that levels into Bulldoze receives Earthquake as specified', () => {
  const result = buildLearnset(data, 232, { includeEvolution: false })
  const earthquake = result.levelUp.find(row => row.name === '地震')
  assert.ok(earthquake.learning_sources.some(s => s.method === '手册：升级重踏可学地震'))
})

test('empty form pools are reported instead of falling back to a different form', () => {
  const empty = data.pokemon.find(p => p.identifier === 'charizard-gmax')
  const result = buildLearnset(data, empty.id)
  assert.equal(result.levelUp.length, 0)
  assert.ok(result.missingSources.some(p => p.id === empty.id))
  assert.ok(result.machine.length > 0)
})

test('racial spell levels follow the 20-level thresholds and include cantrips', () => {
  assert.deepEqual([1, 19, 20, 39, 40, 99, 100].map(racialMaxLevel), [1, 1, 2, 2, 3, 5, 6])
  assert.deepEqual(moveLevels({ cantrip: 'text', level_1: '', level_2: 'text', level_12: 'text' }), [0, 2, 12])
  assert.equal(normalizeSearch('ＤＤ 金勾臂'), normalizeSearch('DD金勾臂'))
  assert.equal(normalizeSearch('多边兽２型'), normalizeSearch('多边兽2型'))
})

test('every Pokémon can be queried and all result rows have details and unique names', () => {
  for (const p of data.pokemon) {
    const result = buildLearnset(data, p.id)
    for (const key of ['levelUp', 'machine', 'other', 'compensation']) {
      const rows = result[key]
      assert.equal(new Set(names(rows)).size, rows.length, `${p.name}: ${key}`)
      assert.ok(rows.every(row => row.learning_sources.length && row.available_levels.length), `${p.name}: ${key}`)
    }
  }
})
