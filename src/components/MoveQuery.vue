<template>
  <div class="move-query">
    <!-- ── 搜索面板 ───────────────────────────────────── -->
    <el-card shadow="never" class="filter-card">
      <el-form :model="filters" label-width="80px" size="default">

        <!-- 第一行：名称 / 学派 / 属性 -->
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="名称">
              <el-input
                v-model="filters.name"
                placeholder="招式名称（支持模糊）"
                clearable
                @keyup.enter="doSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="学派">
              <el-select
                v-model="filters.school"
                placeholder="全部学派"
                clearable
                style="width:100%"
              >
                <el-option
                  v-for="s in options.schools"
                  :key="s"
                  :label="s"
                  :value="s"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="属性">
              <el-select
                v-model="filters.property"
                placeholder="全部属性"
                clearable
                style="width:100%"
              >
                <el-option
                  v-for="p in options.properties"
                  :key="p"
                  :label="p"
                  :value="p"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 第二行：动作 / 附赠 / 反应 / 专注 -->
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="动作">
              <el-select v-model="filters.uses_action" clearable style="width:100%">
                <el-option label="全部" :value="null" />
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="附赠动作">
              <el-select v-model="filters.uses_bonus_action" clearable style="width:100%">
                <el-option label="全部" :value="null" />
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="反应">
              <el-select v-model="filters.uses_reaction" clearable style="width:100%">
                <el-option label="全部" :value="null" />
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="专注">
              <el-select v-model="filters.requires_concentration" clearable style="width:100%">
                <el-option label="全部" :value="null" />
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 第三行：法术成分 / 首环位 / 仪式 -->
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="法术成分">
              <el-select
                v-model="filters.components"
                placeholder="全部成分"
                clearable
                multiple
                collapse-tags
                collapse-tags-tooltip
                style="width:100%"
              >
                <el-option label="语言 V" value="V" />
                <el-option label="姿势 S" value="S" />
                <el-option label="材料 M" value="M" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="首环位">
              <el-select
                v-model="filters.first_level"
                placeholder="全部环位"
                clearable
                style="width:100%"
              >
                <el-option label="戏法（0环）" :value="0" />
                <el-option label="1 环" :value="1" />
                <el-option label="2 环" :value="2" />
                <el-option label="3 环" :value="3" />
                <el-option label="4 环" :value="4" />
                <el-option label="5 环" :value="5" />
                <el-option label="6 环" :value="6" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="仪式">
              <el-select v-model="filters.ritual" clearable style="width:100%">
                <el-option label="全部" :value="null" />
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 第四行：施法关键属性 -->
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="施法属性">
              <el-select
                v-model="filters.casting_ability"
                placeholder="全部施法属性"
                clearable
                multiple
                collapse-tags
                collapse-tags-tooltip
                style="width:100%"
              >
                <el-option
                  v-for="a in options.casting_abilities"
                  :key="a"
                  :label="a"
                  :value="a"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="16" style="display:flex; align-items:flex-start; gap:12px; padding-top:2px">
            <el-button type="primary" :icon="Search" @click="doSearch">
              查询
            </el-button>
            <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          </el-col>
        </el-row>

      </el-form>
    </el-card>

    <!-- ── 结果区域 ───────────────────────────────────── -->
    <el-card shadow="never" class="result-card">
      <template #header>
        <div class="result-header">
          <span>
            查询结果
            <el-tag type="info" effect="plain" v-if="total !== null">
              共 {{ total }} 条
            </el-tag>
          </span>
          <el-tag v-if="loading" type="warning" effect="dark">查询中...</el-tag>
        </div>
      </template>

      <!-- 表格 -->
      <el-table
        :data="results"
        v-loading="loading"
        stripe
        border
        style="width:100%"
        size="small"
        @expand-change="onExpandChange"
      >
        <el-table-column prop="name" label="名称" min-width="120" fixed />
        <el-table-column prop="school" label="学派" width="60" align="center" />
        <el-table-column prop="property" label="属性" min-width="100" />
        <el-table-column label="资源" width="160" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.uses_action" size="small" type="primary" effect="plain">动作</el-tag>
            <el-tag v-if="row.uses_bonus_action" size="small" type="success" effect="plain">附赠</el-tag>
            <el-tag v-if="row.uses_reaction" size="small" type="warning" effect="plain">反应</el-tag>
            <span v-if="!row.uses_action && !row.uses_bonus_action && !row.uses_reaction" class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="成分" width="130" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.has_verbal" size="small" type="danger" effect="plain">V</el-tag>
            <el-tag v-if="row.has_somatic" size="small" type="warning" effect="plain">S</el-tag>
            <el-tag v-if="row.has_material" size="small" type="info" effect="plain">M</el-tag>
            <span v-if="!row.has_verbal && !row.has_somatic && !row.has_material" class="dim">无</span>
          </template>
        </el-table-column>
        <el-table-column label="距离" width="110">
          <template #default="{ row }">
            <span class="range-cell">
              <span class="range-text">{{ threatlessRange(row.range) }}</span>
              <el-tag v-if="hasThreat(row.range)" size="small" type="danger" effect="dark" class="threat-tag">*受威胁</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="持续时间" min-width="120" />

        <el-table-column label="专注" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.requires_concentration" type="warning" effect="dark" size="small">专注</el-tag>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column prop="casting_ability" label="施法属性" min-width="110" />

        <el-table-column label="仪式" width="60" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ritual" type="primary" effect="dark" size="small">仪式</el-tag>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column type="expand" width="36">
          <template #default="{ row }">
            <div class="expanded-detail">
              <!-- 多环位时显示删除线数据丢失提示（紧凑型） -->
              <div v-if="hasMultipleLevels(row)" class="strike-tip">
                ⚠ 高环位仅显示相比低环位的修改内容，原始删除线已丢失，请结合低环位理解。
              </div>

              <div v-if="row.cantrip" class="detail-box level-box">
                <span class="level-label">戏法</span>
                <div class="level-body">{{ row.cantrip }}</div>
              </div>
              <div v-if="row.level_1" class="detail-box level-box">
                <span class="level-label">1 环</span>
                <div class="level-body">{{ row.level_1 }}</div>
              </div>
              <div v-if="row.level_2" class="detail-box level-box">
                <span class="level-label">2 环</span>
                <div class="level-body">{{ row.level_2 }}</div>
              </div>
              <div v-if="row.level_3" class="detail-box level-box">
                <span class="level-label">3 环</span>
                <div class="level-body">{{ row.level_3 }}</div>
              </div>
              <div v-if="row.level_4" class="detail-box level-box">
                <span class="level-label">4 环</span>
                <div class="level-body">{{ row.level_4 }}</div>
              </div>
              <div v-if="row.level_5" class="detail-box level-box">
                <span class="level-label">5 环</span>
                <div class="level-body">{{ row.level_5 }}</div>
              </div>
              <div v-if="row.level_6" class="detail-box level-box">
                <span class="level-label">6 环</span>
                <div class="level-body">{{ row.level_6 }}</div>
              </div>
              <div v-if="row.level_7" class="detail-box level-box">
                <span class="level-label">7 环</span>
                <div class="level-body">{{ row.level_7 }}</div>
              </div>
              <div v-if="row.level_8" class="detail-box level-box">
                <span class="level-label">8 环</span>
                <div class="level-body">{{ row.level_8 }}</div>
              </div>
              <div v-if="row.level_9" class="detail-box level-box">
                <span class="level-label">9 环</span>
                <div class="level-body">{{ row.level_9 }}</div>
              </div>
              <div v-if="row.level_10" class="detail-box level-box">
                <span class="level-label">10 环</span>
                <div class="level-body">{{ row.level_10 }}</div>
              </div>
              <div v-if="row.level_11" class="detail-box level-box">
                <span class="level-label">11 环</span>
                <div class="level-body">{{ row.level_11 }}</div>
              </div>
              <div v-if="row.level_12" class="detail-box level-box">
                <span class="level-label">12 环</span>
                <div class="level-body">{{ row.level_12 }}</div>
              </div>
              <div v-if="row.upcast_effect" class="detail-box">
                <strong>升环效果：</strong>{{ row.upcast_effect }}
              </div>
              <div v-if="row.flavor_effect" class="detail-box">
                <strong>剧情效果：</strong>{{ row.flavor_effect }}
              </div>
              <!-- 表格 -->
              <div v-if="row.tables && row.tables.length" class="detail-box">
                <strong>表格：</strong>
                <div
                  v-for="(tbl, ti) in row.tables"
                  :key="ti"
                  class="move-table-wrap"
                  v-html="tbl"
                ></div>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty v-if="!loading && total === 0" description="没有匹配的招式" />

      <!-- 分页 -->
      <div class="pagination-wrap" v-if="total && total > pageSize">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next, jumper, ->, total"
          background
          @current-change="onPageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { queryMoves, getFilterOptions } from '../api/moves.js'

// ── 状态 ──────────────────────────────────────────────

const filters = reactive({
  name: '',
  school: null,
  property: null,
  uses_action: null,
  uses_bonus_action: null,
  uses_reaction: null,
  components: [],
  first_level: null,
  requires_concentration: null,
  casting_ability: [],
  ritual: null,
})

const options = reactive({
  schools: [],
  properties: [],
  casting_abilities: [],
})

const results = ref([])
const total = ref(null)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

/** 全量数据缓存，用于分页时避免重复过滤 */
let allFiltered = []

// ── 方法 ──────────────────────────────────────────────

/** 将 filters 转为查询参数对象 */
function buildFilterParams() {
  const params = {}
  for (const [key, val] of Object.entries(filters)) {
    // 数组类型：只传非空数组
    if (Array.isArray(val)) {
      if (val.length > 0) {
        params[key] = val
      }
    } else if (val !== null && val !== '') {
      params[key] = val
    }
  }
  return params
}

/** 执行查询 */
async function doSearch() {
  page.value = 1
  loading.value = true
  try {
    const params = buildFilterParams()
    // 先不做分页，缓存全量过滤结果，供分页时直接切片
    const res = await queryMoves(params, 1, 999999)
    allFiltered = res.results
    total.value = res.total
    // 取当前页
    const offset = 0
    results.value = allFiltered.slice(offset, offset + pageSize.value)
  } catch (err) {
    console.error('查询失败:', err)
    ElMessage.error('查询失败: ' + (err.message || err))
    results.value = []
    total.value = 0
    allFiltered = []
  } finally {
    loading.value = false
    nextTick(() => triggerMathJax())
  }
}

/** 切换页 */
function onPageChange(newPage) {
  page.value = newPage
  const offset = (newPage - 1) * pageSize.value
  results.value = allFiltered.slice(offset, offset + pageSize.value)
  nextTick(() => triggerMathJax())
}

/** 展开/收起行 —— 展开时触发 MathJax 重新排版 */
function onExpandChange(row, expandedRows) {
  if (expandedRows.includes(row)) {
    nextTick(() => triggerMathJax())
  }
}

/** 重置筛选 */
async function resetFilters() {
  for (const key of Object.keys(filters)) {
    if (key === 'casting_ability' || key === 'components') {
      filters[key] = []
    } else {
      filters[key] = null
    }
  }
  filters.name = ''
  page.value = 1
  await doSearch()
}

/** 检查招式是否有多个环位（用于显示删除线丢失提示） */
function hasMultipleLevels(row) {
  const levelFields = ['cantrip', 'level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6', 'level_7', 'level_8', 'level_9', 'level_10', 'level_11', 'level_12']
  let count = 0
  for (const f of levelFields) {
    if (row[f]) count++
    if (count >= 2) return true
  }
  return false
}

/** 检查距离是否包含"受威胁" */
function hasThreat(range) {
  return range && range.includes('受威胁')
}

/** 去掉距离中的"（受威胁）"后缀（受威胁标签单独显示） */
function threatlessRange(range) {
  if (!range) return ''
  return range.replace(/\s*（受威胁）\s*$/, '')
}

/** 加载筛选选项 */
async function loadOptions() {
  try {
    const res = await getFilterOptions()
    options.schools = res.schools
    options.properties = res.properties
    options.casting_abilities = res.casting_abilities
  } catch (err) {
    console.error('加载筛选选项失败:', err)
  }
}

/** 触发 MathJax 对当前可见内容重新排版 */
function triggerMathJax() {
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise().catch(err => {
      console.warn('MathJax 排版出错（通常无害）:', err)
    })
  }
}

// ── 初始化 ────────────────────────────────────────────

onMounted(async () => {
  await loadOptions()
  // 初始加载所有数据
  await doSearch()
})
</script>

<style scoped>
.move-query {
  max-width: 1400px;
  margin: 0 auto;
  font-size: 14px;
}

.filter-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.result-card {
  border-radius: 8px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 15px;
}

.dim {
  color: #c0c4cc;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.expanded-detail {
  padding: 12px 16px;
  line-height: 1.75;
  font-size: 14px;
}

.detail-box {
  background: #fafafa;
  border-radius: 4px;
  padding: 10px 14px;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.level-box {
  border-left: 3px solid #409eff;
}

.level-label {
  display: inline-block;
  font-weight: 700;
  font-size: 14px;
  color: #409eff;
  margin-bottom: 6px;
}

.level-body {
  line-height: 1.75;
}

/* 紧凑型删除线提示条 */
.strike-tip {
  background: #fef7e0;
  border: 1px solid #f5d98a;
  border-radius: 4px;
  padding: 6px 10px;
  margin-bottom: 10px;
  font-size: 12.5px;
  color: #8a6d1c;
  line-height: 1.5;
}

/* ── 距离列：受威胁标签 ── */
.range-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.range-text {
  font-size: 13px;
}
.threat-tag {
  flex-shrink: 0;
}

/* ── 表格渲染 ── */
.move-table-wrap {
  overflow-x: auto;
  margin-top: 4px;
}

.move-table-wrap :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.move-table-wrap :deep(td) {
  border: 1px solid #d9d9d9;
  padding: 5px 10px;
  vertical-align: top;
}

.move-table-wrap :deep(tr:first-child td) {
  background: #f0f5ff;
  font-weight: 600;
}

/* ── el-table 全局字号 ── */
:deep(.el-table .cell) {
  font-size: 13px;
}
:deep(.el-table th .cell) {
  font-size: 13px;
  font-weight: 700;
}
</style>
