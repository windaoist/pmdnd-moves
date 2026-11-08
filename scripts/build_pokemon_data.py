"""Build an offline PokéAPI snapshot and PMDnD learning rules (Python stdlib only).

Run from static-web: python scripts/build_pokemon_data.py --data-dir ../data
PokéAPI's own CSV database is used instead of making thousands of REST requests.
"""

import argparse
import csv
import hashlib
import json
import re
import time
import unicodedata
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

SOURCE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/{ref}/data/v2/csv/"
TABLES = ["pokemon", "pokemon_species", "pokemon_species_names", "moves", "move_names",
          "version_groups", "versions", "version_names", "pokemon_types", "pokemon_forms",
          "pokemon_form_names", "pokemon_evolution", "pokemon_move_methods", "pokemon_moves"]
TYPES = {1: "一般", 2: "格斗", 3: "飞行", 4: "毒", 5: "地面", 6: "岩石", 7: "虫",
         8: "幽灵", 9: "钢", 10: "火", 11: "水", 12: "草", 13: "电", 14: "超能力",
         15: "冰", 16: "龙", 17: "恶", 18: "妖精"}
# Spelling/translation differences between the supplied handbook and PokéAPI.
ALIASES = {
    "居合斩": "居合劈", "自爆": "玉石俱碎", "起死回生": "绝处逢生",
    "鬼面": "可怕面孔", "诅咒": "迟缓诅咒", "鬼火": "磷火",
    "地狱翻滚": "深渊翻滚", "断头钳": "极落钳", "灭亡之歌": "终焉之歌",
    "流沙地狱": "流沙深渊", "空气斩": "空气之刃", "青草搅拌器": "青草搅拌机",
    "森林诅咒": "森林咒术", "死缠烂打": "纠缠不休", "地狱突刺": "深渊突刺",
    "死亡之翼": "归天之翼", "换档": "换挡",
    "电磁飘浮": "电磁悬浮", "咒术": "迟缓诅咒",
    "超级吸取": "吸取", "终极吸取": "吸取",
    "纹理2": "纹理 2（纹理2）", "喝牛奶": "喝牛奶（喝羊奶）",
    "V热焰": "V 热焰（V热焰）", "DD金勾臂": "DD 金勾臂（DD金勾臂）",
}


def normalize(s):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", s))


def load_tables(cache, ref, refresh):
    cache.mkdir(parents=True, exist_ok=True)

    def get(name):
        path = cache / f"{name}.csv"
        if refresh or not path.exists():
            url = SOURCE.format(ref=ref) + path.name
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(url, timeout=90) as response:
                        content = response.read()
                    temp = path.with_suffix(".tmp")
                    temp.write_bytes(content)
                    temp.replace(path)
                    break
                except OSError:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
        return name, list(csv.DictReader(path.open(encoding="utf-8", newline="")))

    with ThreadPoolExecutor(max_workers=5) as pool:
        return dict(pool.map(get, TABLES))


def name_map(rows, key, field="name", language="12"):
    return {int(r[key]): r[field] for r in rows if r["local_language_id"] == language and r[field]}


def make_rules(raw_moves, manual):
    names = {normalize(m["name"]): m["name"] for m in raw_moves}
    aliases = dict(names)
    aliases.update({normalize(a): b for a, b in ALIASES.items()})
    merged = {}
    for move in raw_moves:
        note = move.get("raw_description", "")
        if re.search(r"合并为[此本]招式", note):
            originals = re.findall(r"“([^”]+)”", note.split("合并为")[0])
            merged[move["name"]] = originals
            for original in originals:
                aliases[normalize(original)] = move["name"]
        match = re.search(r"招式别名[：:]([^\n]+)", note)
        if match:
            for alias in re.split(r"[、，,]", match[1]):
                aliases[normalize(alias.strip("。 "))] = move["name"]
        if "虫鸣" in note and "改为学习" in note:
            aliases[normalize("虫鸣")] = move["name"]

    section = manual.split("## 属性基本招式", 1)[1].split("{{note", 1)[0]
    basic = {}
    for match in re.finditer(r"#### ([^\n]+)\n+([^#]+?)(?=\n#### |\Z)", section):
        kind = match[1].replace("属性", "").strip()
        # Ignore Homebrewery layout directives between paragraphs.
        line = next(line.strip() for line in match[2].splitlines() if "、" in line)
        originals = re.split(r"[、。]", line.strip())
        missing = [n for n in originals if n and normalize(n) not in aliases]
        if missing:
            raise ValueError(f"Unmapped basic moves for {kind}: {missing}")
        basic[kind] = list(dict.fromkeys(aliases[normalize(n)] for n in originals if n))

    # The handbook lists type cantrips in a separate section. Include its original
    # cantrips too, without granting unrelated exclusive or legendary actions.
    cantrip_section = manual.split("## 种族戏法", 1)[1].split("### 第一世代", 1)[0]
    cantrips = {}
    for match in re.finditer(r"### ([^\n]+)\n(.*?)(?=\n### |\Z)", cantrip_section, re.S):
        kind = match[1].replace("属性", "").strip()
        cantrips[kind] = [names[normalize(n.strip())]
                          for n in re.findall(r"^#### ([^\n]+)", match[2], re.M)
                          if normalize(n.strip()) in names]
    notes = {m["name"]: m["raw_description"] for m in raw_moves if m.get("raw_description")}
    return aliases, {"basic": basic, "cantrips": cantrips, "merged": merged, "notes": notes}


def apply_type_rules(pokemon, player_manual):
    section = player_manual.split("### 宝可梦属性调整", 1)[1].split("### 异色宝可梦", 1)[0]
    adjustments = []
    for block in re.finditer(r"##### (\S+)属性\n(.*?)(?=\n##### |\Z)", section, re.S):
        target = block[1]
        for line in block[2].splitlines():
            match = re.match(r"以下宝可梦的\*\*(.+?)\*\*属性变为.+?：(.+?)。", line)
            added = re.match(r"以下宝可梦获得.+?属性：(.+?)。", line)
            if not match and not added:
                continue
            old = match[1] if match else None
            for entry in re.split(r"[、；]", match[2] if match else added[1]):
                entry = entry.strip()
                qualifier = re.search(r"（([^）]+)）", entry)
                name = re.sub(r"（[^）]+）", "", entry)
                mega = name.startswith("超级")
                if mega:
                    name = name[2:]
                matches = []
                for p in pokemon:
                    if normalize(p["species_name"]) != normalize(name):
                        continue
                    slug = p["identifier"]
                    if qualifier and "伽勒尔" in qualifier[1] and not slug.endswith("-galar"):
                        continue
                    if qualifier and "非超级" in qualifier[1] and "-mega" in slug:
                        continue
                    if mega and "-mega" not in slug:
                        continue
                    if old and old not in p["types"]:
                        continue
                    matches.append(p)
                    p["types"] = [target if t == old else t for t in p["types"]] if old else list(dict.fromkeys(p["types"] + [target]))
                    p["type_notes"].append(f"{old} → {target}" if old else f"新增{target}属性")
                if not matches:
                    raise ValueError(f"Type adjustment did not match any Pokémon: {entry} ({old} -> {target})")
                adjustments.append({"entry": entry, "from": old, "to": target,
                                    "pokemon": [p["id"] for p in matches]})
    return adjustments


def build(tables, data_dir):
    raw = json.loads((data_dir / "moves.json").read_text(encoding="utf-8"))
    manual = (data_dir / "HB-PMDnD招式手册.txt").read_text(encoding="utf-8")
    player = (data_dir / "HB-PMDnD玩家手册.txt").read_text(encoding="utf-8")
    aliases, rules = make_rules(raw, manual)
    species_names = name_map(tables["pokemon_species_names"], "pokemon_species_id")
    species = {int(r["id"]): r for r in tables["pokemon_species"]}
    move_names = name_map(tables["move_names"], "move_id")
    english_moves = {int(r["id"]): r["identifier"] for r in tables["moves"]}
    forms = {int(r["id"]): r for r in tables["pokemon_forms"]}
    form_names = name_map(tables["pokemon_form_names"], "pokemon_form_id", "form_name")
    pokemon_forms = {int(r["pokemon_id"]): r for r in tables["pokemon_forms"] if r["is_default"] == "1"}
    defaults = {int(r["species_id"]): int(r["id"]) for r in tables["pokemon"] if r["is_default"] == "1"}
    original_types = defaultdict(list)
    for r in sorted(tables["pokemon_types"], key=lambda r: int(r["slot"])):
        original_types[int(r["pokemon_id"])].append(TYPES[int(r["type_id"])])
    pokemon = []
    for r in tables["pokemon"]:
        pid, sid = int(r["id"]), int(r["species_id"])
        form = pokemon_forms.get(pid, {})
        form_name = form_names.get(int(form.get("id", 0)), form.get("form_identifier", ""))
        if not form_name and r["is_default"] != "1":
            form_name = r["identifier"]
        pokemon.append({"id": pid, "species_id": sid, "identifier": r["identifier"],
                        "species_name": species_names[sid], "form_name": form_name,
                        "name": species_names[sid] + (f"（{form_name}）" if form_name else ""),
                        "is_default": r["is_default"] == "1", "gender_rate": int(species[sid]["gender_rate"]),
                        "original_types": original_types[pid], "types": original_types[pid][:], "type_notes": []})
    rules["type_adjustments"] = apply_type_rules(pokemon, player)

    # Form IDs are distinct from Pokémon IDs. Preserve regional evolution paths.
    edges = set()
    for r in tables["pokemon_evolution"]:
        sid = int(r["evolved_species_id"])
        parent = species[sid]["evolves_from_species_id"]
        if not parent:
            continue
        source_form = forms.get(int(r["required_pokemon_form_id"] or 0))
        dest_form = forms.get(int(r["evolved_pokemon_form_id"] or 0))
        source = int(source_form["pokemon_id"]) if source_form else defaults[int(parent)]
        dest = int(dest_form["pokemon_id"]) if dest_form else defaults[sid]
        edges.add((source, dest, int(r["gender_id"] or 0)))

    versions = {int(r["id"]): r for r in tables["version_groups"]}
    version_names = name_map(tables["version_names"], "version_id")
    version_labels = defaultdict(list)
    for r in tables["versions"]:
        version_labels[int(r["version_group_id"])].append(version_names.get(int(r["id"]), r["identifier"]))
    # Exclude spinoffs and event-only methods; don't infer learnsets for empty forms.
    excluded = {"colosseum", "xd", "champions"}
    latest = defaultdict(int)
    for r in tables["pokemon_moves"]:
        v = versions[int(r["version_group_id"])]
        if v["identifier"] not in excluded:
            pid = int(r["pokemon_id"])
            latest[pid] = max(latest[pid], int(v["generation_id"]))
    # One entry per (original move, method), with all latest-generation games.
    pools = defaultdict(dict)
    for r in tables["pokemon_moves"]:
        pid, vid = int(r["pokemon_id"]), int(r["version_group_id"])
        v = versions[vid]
        if v["identifier"] in excluded or int(v["generation_id"]) != latest[pid]:
            continue
        method = int(r["pokemon_move_method_id"])
        if method not in {1, 2, 3, 4, 6, 10, 11, 12}:
            continue
        key = (int(r["move_id"]), method)
        entry = pools[pid].setdefault(key, [key[0], method, int(r["level"]), []])
        entry[2] = min(entry[2], int(r["level"]))
        if vid not in entry[3]:
            entry[3].append(vid)
    for p in pokemon:
        p["generation"] = latest[p["id"]] or None
        p["versions"] = sorted({vid for entry in pools[p["id"]].values() for vid in entry[3]})
        p["moves"] = sorted(pools[p["id"]].values())
    mapping = {str(mid): {"name": name, "identifier": english_moves.get(mid, ""),
                          "rule": aliases.get(normalize(name))} for mid, name in move_names.items()}
    # Keep English fallback for new moves not translated yet; report, never silently drop.
    for mid, name in english_moves.items():
        mapping.setdefault(str(mid), {"name": name, "identifier": name, "rule": None})
    rules["move_map"] = mapping
    rules["evolutions"] = sorted(edges)
    rules["versions"] = {str(vid): {"name": " / ".join(version_labels[vid]) or v["identifier"],
                                    "identifier": v["identifier"], "generation": int(v["generation_id"])}
                         for vid, v in versions.items()}
    rules["methods"] = {r["id"]: r["identifier"] for r in tables["pokemon_move_methods"]}
    return pokemon, rules


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[2] / "data")
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--ref", default="master", help="PokéAPI Git ref; pass a commit SHA for a pinned rebuild")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    cache = args.cache_dir or args.data_dir / "pokeapi-cache"
    tables = load_tables(cache, args.ref, args.refresh)
    pokemon, rules = build(tables, args.data_dir)
    metadata = {"source": "https://github.com/PokeAPI/pokeapi/tree/" + args.ref + "/data/v2/csv",
                "api": "https://pokeapi.co/api/v2/", "ref": args.ref,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "latest_generation_policy": "Union of main-series version groups in each Pokémon's latest recorded generation",
                "sha256": {name: hashlib.sha256((cache / f"{name}.csv").read_bytes()).hexdigest() for name in TABLES},
                "handbook_sha256": {name: hashlib.sha256((args.data_dir / name).read_bytes()).hexdigest()
                                    for name in ["moves.json", "HB-PMDnD玩家手册.txt", "HB-PMDnD招式手册.txt"]}}
    out = Path(__file__).resolve().parents[1] / "public" / "data"
    out.mkdir(parents=True, exist_ok=True)
    for name, value in [("pokemon.json", {"metadata": metadata, "pokemon": pokemon}), ("pokemon-rules.json", rules)]:
        path = out / name
        path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{path.name}: {path.stat().st_size:,} bytes")
    print(f"{len(pokemon)} Pokémon/forms; {sum(bool(p['moves']) for p in pokemon)} recorded learnsets")
    print(f"{len(rules['basic'])} basic type lists; {len(rules['cantrips'])} cantrip lists; {len(rules['merged'])} merged moves")


if __name__ == "__main__":
    main()
