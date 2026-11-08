# PMDnD 招式查询

保留原有招式查询，新增“宝可梦可学招式”页。纯 Vue 静态站点，兼容 GitHub Pages 子目录，无需后端。宝可梦数据随站点发布，浏览时不请求外部 API（原页面的 MathJax 仍使用 CDN）。

```powershell
npm install
npm run dev
npm test
npm run build
```

## 按宝可梦查询

- 中文名、英文名或全国图鉴编号检索，区域形态分别列出。
- 升级、学习器、其他教学/卷轴分栏；复用原有招式筛选、分页和完整详情。
- 默认按手册纳入唯一可达进化型，教学范围另含退化种族；可指定性别或关闭进化来源。原作学习等级不限制 PMDnD 学习。
- 每个来源形态取 PokeAPI **有主系列招式记录的最新世代**，合并该世代版本，不把旧世代招式累加进去。不同来源种族可能使用不同世代。
- 根据玩家手册调整属性；任意属性与所纳入来源种族的调整后属性基本招式、属性种族戏法（包括原创）按需求归入学习器栏，显示实际来源。手册原文也允许基本招式升级自学。
- 处理“合并为此招式”“合并为本招式”、明确的别名与译名差异；重踏→地震的额外学习规则也保留。伊布补偿候选另列，合计最多选 4 个。
- 使用最高种族挑战等级计算种族最大环位，可筛选当前可学招式。不同环位须分别学习。
- 未匹配的原作招式与没有招式池的形态会明确列出，不自动套用其他形态的数据。职业法术、已学招式的成长历史及 DM 特批需自行判断。

## 更新数据

来源是 [PokeAPI 官方数据库](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)，即其 API 使用的 CSV 数据；批量读取避免逐个请求数千个 REST 资源。生成器仅使用 Python 标准库，下载带本地缓存和重试。

```powershell
python scripts/build_pokemon_data.py --data-dir ../data
# 主动刷新缓存
python scripts/build_pokemon_data.py --data-dir ../data --refresh
# 固定 PokeAPI 版本，使用独立缓存，便于重建
python scripts/build_pokemon_data.py --data-dir ../data --ref <commit-sha> --cache-dir ../data/pokeapi-pinned --refresh
```

输入是 `moves.json`、`HB-PMDnD玩家手册.txt` 和 `HB-PMDnD招式手册.txt`。默认在本仓库外的 `../data/pokeapi-cache` 缓存 PokeAPI CSV；可通过 `--data-dir`、`--cache-dir` 指定路径。生成产物为 `public/data/pokemon.json` 和 `pokemon-rules.json`。快照记录来源、时间及 CSV/手册 SHA-256 校验值。更新后运行 `npm test`、`npm run build`，部署 `dist` 即可。

测试覆盖实际全量数据、最新世代隔离、进化与性别分支、区域形态、全部合并条目、属性调整、原创招式、伊布补偿与环位边界。
