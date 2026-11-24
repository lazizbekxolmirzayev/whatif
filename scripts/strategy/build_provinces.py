"""Data pipeline: builds province geometry + per-year historical ownership.
Sources: Natural Earth admin-1 (public domain) as province shapes,
aourednik/historical-basemaps (GPL-3.0) for historical political boundaries.
Province = modern admin-1 region (approximation of historical provinces);
owner in a given year = historical polity containing the province's representative point."""
import json, sys, collections, math
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

NE = sys.argv[1]; HB = sys.argv[2]; OUT = sys.argv[3]
adm = json.load(open(f"{NE}/ne_10m_admin_1_states_provinces.geojson"))["features"]
cnt = collections.Counter(f["properties"]["admin"] for f in adm)
regs = collections.defaultdict(set)
for f in adm: regs[f["properties"]["admin"]].add(f["properties"]["region"])
WHOLE = {"The Bahamas", "Malta", "Moldova", "Dominican Republic"}
tot = collections.Counter()
for f in adm:
    gg = shape(f["geometry"]); tot[f["properties"]["admin"]] += gg.area * 12392 * math.cos(math.radians(gg.centroid.y))
WHOLE |= {a for a, v in tot.items() if v < 12000 and cnt[a] > 1}
groups = collections.OrderedDict()
for f in adm:
    p = f["properties"]; a = p["admin"]
    if a in WHOLE: key = (a, a)
    elif cnt[a] >= 40 and len([r for r in regs[a] if r]) >= 4 and p["region"]:
        key = (a, p["region"])
    else: key = (a, p["adm1_code"])
    g = make_valid(shape(f["geometry"]))
    groups.setdefault(key, {"names": [], "geoms": []})
    groups[key]["names"].append(p["name"] or p["name_en"] or "Unnamed")
    groups[key]["geoms"].append(g)

ocean = unary_union([make_valid(shape(f["geometry"])) for f in json.load(open(f"{NE}/ne_50m_ocean.geojson"))["features"]])
rivers = [shape(f["geometry"]) for f in json.load(open(f"{NE}/ne_50m_rivers_lake_centerlines.geojson"))["features"] if (f["properties"].get("scalerank") or 9) <= 6]
rtree = STRtree(rivers)
geo = json.load(open(f"{NE}/ne_50m_geography_regions_polys.geojson"))["features"]
deserts = [make_valid(shape(f["geometry"])) for f in geo if f["properties"]["FEATURECLA"] == "Desert"]
mtns = [make_valid(shape(f["geometry"])) for f in geo if f["properties"]["FEATURECLA"] == "Range/mtn"]
dtree, mtree = STRtree(deserts), STRtree(mtns)

feats, meta = [], []
for i, ((admin, key), g) in enumerate(groups.items()):
    geom = unary_union(g["geoms"])
    if geom.is_empty: continue
    rp = geom.representative_point()
    lat = rp.y
    area = geom.area * 111.32 * 111.32 * math.cos(math.radians(lat))
    name = key if len(g["names"]) > 1 else g["names"][0]
    coastal = geom.buffer(0.08).intersects(ocean)
    river = any(geom.intersects(rivers[j]) for j in rtree.query(geom))
    desert = any(deserts[j].contains(rp) for j in dtree.query(rp))
    mountain = any(mtns[j].contains(rp) for j in mtree.query(rp))
    idx = len(meta)
    feats.append({"type": "Feature", "properties": {"i": idx}, "geometry": mapping(geom)})
    meta.append({"n": name, "m": admin, "x": round(rp.x, 3), "y": round(rp.y, 3), "a": round(area),
                 "c": int(coastal), "r": int(river), "d": int(desert), "t": int(mountain)})
json.dump({"type": "FeatureCollection", "features": feats}, open("/tmp/prov.geojson", "w"))
json.dump(meta, open(f"{OUT}/provinces_meta.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("provinces", len(meta))

pts = [Point(m["x"], m["y"]) for m in meta]
TRIBAL = ("hunter", "gatherer", "culture", "peoples", "complex", "tribes", "aboriginal", "nomads", "foragers", "pastoralists", "fishers", "fichers", "focus", "horizon", "burials")
years = sys.argv[4].split(",")
index = []
for y in years:
    fs = json.load(open(f"{HB}/world_{y}.geojson"))["features"]
    pols = [(f["properties"], make_valid(shape(f["geometry"]))) for f in fs if f["geometry"] and f["properties"].get("NAME") and f["properties"]["NAME"].strip()]
    tree = STRtree([g for _, g in pols])
    names, nidx, owner = [], {}, []
    for k, pt in enumerate(pts):
        hit = [j for j in tree.query(pt) if pols[j][1].contains(pt)]
        if not hit:
            j = tree.nearest(pt)
            if pols[j][1].distance(pt) > 0.6: owner.append(-1); continue
            hit = [j]
        p = pols[hit[0]][0]; nm = p["NAME"].strip()
        if nm not in nidx:
            nidx[nm] = len(names)
            sub = (p.get("SUBJECTO") or "").strip()
            names.append({"name": nm, "subjectOf": sub if sub and sub != nm else None, "partOf": (p.get("PARTOF") or "").strip() or None,
                          "tribal": any(t in nm.lower() for t in TRIBAL), "precision": p.get("BORDERPRECISION") or 1})
        owner.append(nidx[nm])
    year = -int(y[2:]) if y.startswith("bc") else int(y)
    json.dump({"year": year, "polities": names, "owner": owner}, open(f"{OUT}/owners_{y}.json", "w"), ensure_ascii=False, separators=(",", ":"))
    index.append({"key": y, "year": year, "polities": len(names)})
    print(y, len(names))
json.dump(index, open(f"{OUT}/years.json", "w"))
