<template>
  <div class="pokemon-query" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon>
      <el-button size="small" @click="load">重新加载</el-button>
    </el-alert>

    <template v-if="data">
      <el-card shadow="never" class="pokemon-card">
        <template #header>
          <div class="panel-heading"><strong>按宝可梦查招式</strong><span>选择种族与形态，查看 PMDnD 可学招式</span></div>
        </template>
        <el-form label-position="top" class="pokemon-controls">
          <el-form-item label="宝可梦 / 形态" class="pokemon-select">
            <el-select v-model="selectedId" filterable :filter-method="filterPokemon" placeholder="输入中文名、英文名或全国图鉴编号" @visible-change="resetSearch">
              <el-option v-for="pokemon in choices" :key="pokemon.id" :value="pokemon.id" :label="pokemon.name">
                <span class="dex-number">#{{ String(pokemon.species_id).padStart(4, '0') }}</span>
                {{ pokemon.name }}
              </el-option>
            </el-select>
            <small>支持中文、英文和编号；最多显示 80 个匹配项，请输入名称缩小范围。</small>
          </el-form-item>
          <el-form-item label="角色性别（影响唯一进化分支）">
            <el-select v-model="gender">
              <el-option label="未指定" value="unknown" />
              <el-option v-if="selected?.gender_rate > 0" label="女性" value="female" />
              <el-option v-if="selected?.gender_rate >= 0 && selected?.gender_rate < 8" label="男性" value="male" />
              <el-option v-if="selected?.gender_rate === -1" label="无性别" value="genderless" />
            </el-select>
          </el-form-item>
          <el-form-item label="最高种族挑战等级">
            <el-input-number v-model="racialLevel" :min="1" :max="9999" :precision="0" controls-position="right" />
            <small>通常等于种族等级；当前最大 {{ maxLevel }} 环。</small>
          </el-form-item>
        </el-form>
        <div class="learning-controls">
          <el-checkbox v-model="includeEvolution">按手册纳入唯一可达的进化型与退化种族</el-checkbox>
          <el-checkbox v-model="onlyAvailable">仅显示当前环位可学的招式</el-checkbox>
        </div>
        <div v-if="learnset" class="pokemon-summary">
          <strong>{{ selected.name }}</strong>
          <el-tag v-for="type in selected.types" :key="type" :type="selected.original_types.includes(type) ? 'primary' : 'warning'" effect="plain">{{ type }}</el-tag>
          <span v-if="selected.type_notes.length" class="type-note">手册调整：{{ selected.type_notes.join('；') }}（原属性：{{ selected.original_types.join(' / ') }}）</span>
          <p v-if="selected.generation">本形态采用第 {{ selected.generation }} 世代招式池：{{ selected.versions.map(id => data.rules.versions[id]?.name || id).join('；') }}。</p>
          <p v-if="includeEvolution">升级来源：{{ learnset.sources.levelUp.map(p => p.name).join('、') }}。</p>
          <p v-if="includeEvolution && learnset.sources.ancestors.length">教学另含退化种族：{{ learnset.sources.ancestors.map(p => p.name).join('、') }}。</p>
          <small>每个来源种族分别采用其有记录的最新世代，并合并该世代各主系列版本；原作学习等级只作参考。</small>
        </div>
      </el-card>

      <el-alert v-if="learnset?.missingSources.length" type="warning" :closable="false" show-icon class="data-alert"
        :title="`PokeAPI 暂无以下形态的主系列招式池：${learnset.missingSources.map(p => p.name).join('、')}。未套用普通形态招式池；仍展示规则补充招式。`" />

      <el-collapse class="rules-panel">
        <el-collapse-item title="学习规则与数据说明" name="rules">
          <p>升级学习：当前种族与按进化次数唯一可达的进化型提供升级 / 回忆招式。每升 1 级可选 1 个，忽略原作等级要求；性别未指定时保留所有可能分支。</p>
          <p>教学 / 卷轴：范围还包括退化任意次的种族，可使用学习器、遗传、招式教学等非配信途径。为便于查阅，学习器单列，其他途径另列。</p>
          <p>每逢种族等级为 5 的倍数，这一级升级选招可使用教学 / 卷轴的范围。种族最大环位 = ⌊最高种族挑战等级 ÷ 20⌋ + 1；有多个环位版本的招式须分别学习、分别记忆，种族戏法固有且不占戏法记忆位。</p>
          <p>按本页分类约定，任意属性与所纳入种族的调整后属性基本招式、属性种族戏法（含原创招式）归入“招式学习器”，来源会明确标注。手册基本招式原文也允许升级自学。未将专有动作或传奇动作按属性通用化。</p>
          <p>合并招式和别名映射到本规则的招式名称；能升级学习重踏的种族额外列出地震。伊布的跨属性补偿另列，合计最多选择 4 个，进化后不再具有对应属性的招式失去使用能力。</p>
          <p>进化来源按 PokeAPI 的形态与性别条件推导，遇到分支不会擅自选择。DM 额外许可、已学招式的成长历史和职业法术不由种族查询自动决定。</p>
          <p>规则依据：《HB-PMDnD 玩家手册》第 2 章“天生施法者”、第 8 章“施法”、“宝可梦属性调整”，以及《招式手册》“属性基本招式”“种族戏法”。</p>
          <p>数据：<a :href="data.metadata.source" target="_blank" rel="noreferrer">PokeAPI 官方数据库快照</a> · <a href="https://pokeapi.co/docs/v2#pokemon" target="_blank" rel="noreferrer">API 文档</a>。查询在本地运行，无需实时访问 API。</p>
        </el-collapse-item>
        <el-collapse-item v-if="learnset?.unresolved.length" :title="`原作有记录但本规则未收录 / 未匹配的招式（${unresolvedNames.length} 种）`" name="unresolved">
          <p>这些招式未混入可学结果。下列原作记录可供 DM 核对；同一招式可能出现在多个来源中。</p>
          <ul class="unresolved-list"><li v-for="(source, index) in learnset.unresolved" :key="index">{{ source.original }} · {{ source.pokemon }} · {{ source.method }} · 第 {{ source.generation }} 世代</li></ul>
        </el-collapse-item>
      </el-collapse>

      <template v-if="learnset">
        <el-tabs v-model="activeTab" class="learnset-tabs">
          <el-tab-pane v-for="tab in tabs" :key="tab.key" :name="tab.key" :label="`${tab.label}（${filteredBuckets[tab.key].length}）`" />
        </el-tabs>
        <el-alert v-if="activeTab === 'compensation'" title="伊布补偿：以下八种属性的基本招式合计最多选 4 个。进化后不再具有对应属性的招式失去使用能力。" type="warning" :closable="false" show-icon class="data-alert" />
        <p class="tab-description">{{ tabDescriptions[activeTab] }} 点击名称旁的箭头查看完整招式与学习来源。环位灰色表示超出当前种族最大环位。</p>
        <MoveQuery :source-moves="filteredBuckets[activeTab]" :max-level="maxLevel" :version-names="data.rules.versions" />
      </template>
    </template>
    <el-empty v-else-if="!loading && !error" description="正在准备宝可梦数据" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { loadPokemonData } from '../api/pokemon.js'
import { buildLearnset, normalizeSearch, racialMaxLevel } from '../lib/pokemon-learning.js'
import MoveQuery from './MoveQuery.vue'

const data = shallowRef(null)
const error = ref('')
const loading = ref(false)
const selectedId = ref(1)
const search = ref('')
const gender = ref('unknown')
const racialLevel = ref(1)
const includeEvolution = ref(true)
const onlyAvailable = ref(false)
const activeTab = ref('levelUp')

const selected = computed(() => data.value?.pokemon.find(p => p.id === selectedId.value))
const choices = computed(() => {
  const term = normalizeSearch(search.value)
  const matching = data.value?.pokemon.filter(p => !term ||
    [p.name, p.identifier, String(p.id), String(p.species_id), String(p.species_id).padStart(4, '0')]
      .some(value => normalizeSearch(value).includes(term))) || []
  const visible = matching.slice(0, 80)
  // Element Plus needs the current option even when it is outside the first page.
  if (selected.value && !visible.some(p => p.id === selectedId.value)) visible.unshift(selected.value)
  return visible
})
const maxLevel = computed(() => racialMaxLevel(racialLevel.value))
const learnset = computed(() => data.value && selected.value ? buildLearnset(data.value, selectedId.value, {
  gender: gender.value, includeEvolution: includeEvolution.value,
}) : null)
const filteredBuckets = computed(() => Object.fromEntries(['levelUp', 'machine', 'other', 'compensation'].map(key => [key,
  (learnset.value?.[key] || []).filter(row => !onlyAvailable.value || row.available_levels.some(level => level <= maxLevel.value)),
])))
const unresolvedNames = computed(() => [...new Set(learnset.value?.unresolved.map(s => s.original))])
const tabs = computed(() => [
  { key: 'levelUp', label: '升级可学' }, { key: 'machine', label: '招式学习器' },
  { key: 'other', label: '其他教学 / 卷轴' },
  ...(selected.value?.species_id === 133 ? [{ key: 'compensation', label: '伊布补偿' }] : []),
])
const tabDescriptions = {
  levelUp: '当前种族与唯一可达进化型的升级 / 回忆招式，忽略原作等级。',
  machine: '原作招式学习器，加上来源种族按调整后属性补充的基本招式与种族戏法。',
  other: '遗传、招式教学等其他非配信途径，以及退化种族的升级招式。',
  compensation: '伊布专属的跨属性基本招式候选，合计最多选 4 个。',
}

function filterPokemon(value) { search.value = value }
function resetSearch(visible) { if (visible) search.value = '' }
async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await loadPokemonData() }
  catch (err) { error.value = err.message || String(err) }
  finally { loading.value = false }
}
watch(selectedId, () => {
  gender.value = 'unknown'
  if (activeTab.value === 'compensation') activeTab.value = 'levelUp'
})
onMounted(load)
</script>

<style scoped>
.pokemon-card { border-radius: 8px; margin-bottom: 16px; }
.panel-heading { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: baseline; }
.panel-heading span, small { color: #606266; font-size: 12px; }
.pokemon-controls { display: grid; grid-template-columns: minmax(280px, 2fr) minmax(180px, 1fr) minmax(180px, 1fr); gap: 16px; }
.pokemon-controls :deep(.el-select), .pokemon-controls :deep(.el-input-number) { width: 100%; }
.pokemon-controls small { line-height: 1.6; margin-top: 6px; }
.dex-number { color: #909399; margin-right: 8px; }
.learning-controls { display: flex; gap: 8px 24px; flex-wrap: wrap; }
.pokemon-summary { margin-top: 16px; padding: 16px; background: #f5f9ff; border-radius: 6px; line-height: 1.8; }
.pokemon-summary .el-tag { margin-left: 8px; }
.pokemon-summary p { margin-top: 6px; font-size: 13px; }
.type-note { display: inline-block; color: #9a6700; margin-left: 12px; font-size: 13px; }
.rules-panel { margin: 16px 0; padding: 0 16px; background: white; border-radius: 8px; }
.rules-panel p { margin: 8px 0; }
.rules-panel a { color: #337ecc; }
.data-alert { margin: 12px 0; }
.unresolved-list { padding-left: 20px; max-height: 220px; overflow: auto; }
.learnset-tabs { margin-top: 20px; }
.tab-description { font-size: 13px; color: #606266; line-height: 1.7; margin: 0 0 14px; }
@media (max-width: 760px) {
  .pokemon-controls { grid-template-columns: 1fr; gap: 0; }
  .learning-controls { display: block; }
  .learning-controls .el-checkbox { display: flex; height: auto; min-height: 32px; white-space: normal; margin-right: 0; }
  .type-note { display: block; margin-left: 0; }
  .pokemon-summary { padding: 12px; }
}
</style>
