/**
 * PMDND 招式查询 — 静态数据层
 *
 * 从本地 JSON 加载招式数据，实现完整的客户端过滤和分页。
 * 逻辑对应于原后端 backend/main.py 的 SQL 查询。
 */

const CORE_ABILITIES = ['力量', '敏捷', '体质', '智力', '感知', '魅力']
const OTHER_LABEL = '其他'

/** 正在加载的数据 Promise（缓存） */
let dataPromise = null

/**
 * 加载招式数据（惰性加载，只加载一次）
 */
function loadData() {
  if (!dataPromise) {
    dataPromise = fetch('data/moves.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} — 数据加载失败`)
      return r.json()
    })
  }
  return dataPromise
}

/**
 * 从数据中提取筛选选项（学派、属性、施法关键属性）
 */
export async function getFilterOptions() {
  const moves = await loadData()
  const schools = [...new Set(moves.map(m => m.school).filter(Boolean))]
  const allProps = moves.flatMap(m => m.property_choices || [])
  const properties = [...new Set(allProps)].filter(Boolean)
  const castingAbilities = parseCastingAbilities(moves.map(m => m.casting_ability))

  return { schools, properties, casting_abilities: castingAbilities }
}

/**
 * 将原始施法属性列表拆分为六大核心属性 + "其他"（固定顺序）
 */
function parseCastingAbilities(rawList) {
  const seenCore = new Set()
  let hasOther = false

  for (const raw of rawList) {
    if (!raw) continue
    const parts = raw.split('/')
    for (const part of parts) {
      const cleaned = part.replace(/（[^）]*?）/g, '').trim()
      if (!cleaned) continue
      if (CORE_ABILITIES.includes(cleaned)) {
        seenCore.add(cleaned)
      } else {
        hasOther = true
      }
    }
  }

  const result = CORE_ABILITIES.filter(a => seenCore.has(a))
  if (hasOther) result.push(OTHER_LABEL)
  return result
}

/**
 * 联合查询招式
 *
 * @param {Object} filters - 筛选条件
 * @param {string}  [filters.name]              - 模糊匹配名称
 * @param {string}  [filters.school]            - 精确匹配学派
 * @param {string}  [filters.property]          - property_choices 数组包含
 * @param {boolean} [filters.uses_action]       - 是否消耗动作
 * @param {boolean} [filters.uses_bonus_action] - 是否消耗附赠动作
 * @param {boolean} [filters.uses_reaction]     - 是否为反应
 * @param {string[]} [filters.components]       - 法术成分（数组，如 ['V','S']，AND 匹配）
 * @param {number}  [filters.first_level]       - 首环位（0=戏法, 1-6=对应环，需同时满足）
 * @param {boolean} [filters.requires_concentration] - 是否需要专注
 * @param {string}  [filters.casting_ability]   - 逗号分隔的施法属性（OR 匹配）
 * @param {boolean} [filters.ritual]            - 是否为仪式
 * @param {number}  [page=1]
 * @param {number}  [pageSize=20]
 * @returns {Promise<{total: number, page: number, page_size: number, results: Array}>}
 */
export async function queryMoves(filters, page = 1, pageSize = 20) {
  const moves = await loadData()

  // 1. 过滤
  let filtered = moves.filter(move => {
    // 名称模糊匹配（大小写不敏感）
    if (filters.name) {
      if (!move.name.toLowerCase().includes(filters.name.toLowerCase())) {
        return false
      }
    }
    // 学派精确匹配
    if (filters.school != null && filters.school !== '') {
      if (move.school !== filters.school) return false
    }
    // 属性 — property_choices 数组包含
    if (filters.property != null && filters.property !== '') {
      if (!(move.property_choices || []).includes(filters.property)) {
        return false
      }
    }
    // 动作
    if (filters.uses_action != null) {
      if (move.uses_action !== filters.uses_action) return false
    }
    // 附赠动作
    if (filters.uses_bonus_action != null) {
      if (move.uses_bonus_action !== filters.uses_bonus_action) return false
    }
    // 反应
    if (filters.uses_reaction != null) {
      if (move.uses_reaction !== filters.uses_reaction) return false
    }
    // 法术成分（多选，AND 逻辑：选中的成分招式必须全部具备）
    if (filters.components && filters.components.length > 0) {
      for (const c of filters.components) {
        if (c === 'V' && !move.has_verbal) return false
        if (c === 'S' && !move.has_somatic) return false
        if (c === 'M' && !move.has_material) return false
      }
    }
    // 首环位
    if (filters.first_level != null) {
      const fl = getFirstLevel(move)
      if (fl !== filters.first_level) return false
    }
    // 专注
    if (filters.requires_concentration != null) {
      if (move.requires_concentration !== filters.requires_concentration) return false
    }
    // 施法关键属性
    if (filters.casting_ability) {
      const raw = Array.isArray(filters.casting_ability)
        ? filters.casting_ability.join(',')
        : filters.casting_ability
      const selected = raw.split(',').map(s => s.trim()).filter(Boolean)
      if (selected.length > 0) {
        const matches = matchCastingAbility(move.casting_ability, selected)
        if (!matches) return false
      }
    }
    // 仪式
    if (filters.ritual != null) {
      if (filters.ritual) {
        if (!move.ritual || move.ritual === '') return false
      } else {
        if (move.ritual && move.ritual !== '') return false
      }
    }
    return true
  })

  // 2. 排序（按名称 + 保持原始顺序）
  filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  // 3. 分页
  const total = filtered.length
  const offset = (page - 1) * pageSize
  const results = filtered.slice(offset, offset + pageSize)

  return { total, page, page_size: pageSize, results }
}

/**
 * 判断 move 的 casting_ability 是否匹配任一选中项
 */
function matchCastingAbility(ability, selected) {
  const coreSelected = selected.filter(a => CORE_ABILITIES.includes(a))
  const hasOther = selected.includes(OTHER_LABEL)

  // 先检查核心属性
  for (const a of coreSelected) {
    if (ability.includes(a)) return true
  }

  // 检查"其他"：不属于六大核心属性且不为空
  if (hasOther && ability) {
    const matchesCore = CORE_ABILITIES.some(ca => ability.includes(ca))
    if (!matchesCore) return true
  }

  return false
}

/**
 * 获取招式的最低环位（第一个非空环位）
 * @param {Object} move
 * @returns {number|null} 0=戏法, 1-6=对应环, null=无数据
 */
function getFirstLevel(move) {
  if (move.cantrip) return 0
  if (move.level_1)  return 1
  if (move.level_2)  return 2
  if (move.level_3)  return 3
  if (move.level_4)  return 4
  if (move.level_5)  return 5
  if (move.level_6)  return 6
  return null
}
