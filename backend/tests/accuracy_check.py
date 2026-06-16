"""
Accuracy audit: tests every scale against reference values from the scoring Word docs.
Run from backend/: python tests/accuracy_check.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.scale_engine import scale_engine
from app.services.scale_configs import get_scale_config
from app.services.disease_engine import disease_engine

passed = 0
failed = 0
results = []


def check(name, got, expected, tolerance=0.01):
    global passed, failed
    try:
        ok = abs(float(got) - float(expected)) <= tolerance
    except (TypeError, ValueError):
        ok = str(got) == str(expected)
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    results.append(f"  {status}  {name}: got={got}  expected={expected}")


def make_q(n, max_val=3):
    return [{"options": [{"value": str(i), "points": i} for i in range(max_val + 1)]} for _ in range(n)]


# ── 1. AIS ──────────────────────────────────────────────────────────────────
cfg = get_scale_config("AIS"); cfg["questions"] = make_q(8)
r = scale_engine.calculate_score(cfg, {i: "1" for i in range(8)})
check("AIS all-1 total", r.total, 8)
check("AIS max_possible", r.max_possible, 24)
check("AIS severity@8 -> mild", scale_engine.get_severity(cfg, 8).level, "mild")

# ── 2. ALSFRS-R ──────────────────────────────────────────────────────────────
cfg = get_scale_config("ALSFRS-R"); cfg["questions"] = make_q(12, 4)
r = scale_engine.calculate_score(cfg, {i: "4" for i in range(12)})
check("ALSFRS-R all-4 total", r.total, 48)
check("ALSFRS-R bulbar subscale", r.subscale_scores["bulbar"]["score"], 12)
check("ALSFRS-R severity@48 -> normal", scale_engine.get_severity(cfg, 48).level, "normal")
check("ALSFRS-R severity@15 -> severe", scale_engine.get_severity(cfg, 15).level, "severe")

# ── 3. AMTS ──────────────────────────────────────────────────────────────────
cfg = get_scale_config("AMTS"); cfg["questions"] = make_q(11, 1)
r = scale_engine.calculate_score(cfg, {i: "1" for i in range(10)})
check("AMTS all-correct total", r.total, 10)
check("AMTS severity@5 -> moderate", scale_engine.get_severity(cfg, 5).level, "moderate")
check("AMTS severity@2 -> severe",   scale_engine.get_severity(cfg, 2).level, "severe")

# ── 4. Barthel ───────────────────────────────────────────────────────────────
cfg = get_scale_config("Barthel-Index"); cfg["questions"] = make_q(10, 10)
r = scale_engine.calculate_score(cfg, {i: "10" for i in range(10)})
check("Barthel all-10 total", r.total, 100)
check("Barthel max_possible", r.max_possible, 100)
check("Barthel severity@75 -> moderate", scale_engine.get_severity(cfg, 75).level, "moderate")
check("Barthel severity@10 -> total",    scale_engine.get_severity(cfg, 10).level, "total")

# ── 5. BDI-II ────────────────────────────────────────────────────────────────
cfg = get_scale_config("BDI-II"); cfg["questions"] = make_q(21, 3)
resp = {i: "1" for i in range(21)}
for i in range(10): resp[i] = "2"
r = scale_engine.calculate_score(cfg, resp)
check("BDI-II score 31", r.total, 31)
check("BDI-II severity@31 -> severe",  scale_engine.get_severity(cfg, 31).level, "severe")
check("BDI-II severity@14 -> mild",    scale_engine.get_severity(cfg, 14).level, "mild")
check("BDI-II severity@45 -> extreme", scale_engine.get_severity(cfg, 45).level, "extreme")

# ── 6. COMPASS-31 ────────────────────────────────────────────────────────────
cfg = get_scale_config("COMPASS-31"); cfg["questions"] = make_q(31, 3)
r = scale_engine.calculate_score(cfg, {i: "3" for i in range(31)})
check("COMPASS-31 orthostatic@all-3",      r.domain_scores["orthostatic"]["weighted"], 48.0, tolerance=0.1)
check("COMPASS-31 vasomotor@all-3",        r.domain_scores["vasomotor"]["weighted"],    7.5, tolerance=0.1)
check("COMPASS-31 severity@45 -> moderate", scale_engine.get_severity(cfg, 45).level, "moderate")
check("COMPASS-31 severity@70 -> severe",   scale_engine.get_severity(cfg, 70).level, "severe")

# ── 7. DASS-21 ───────────────────────────────────────────────────────────────
cfg = get_scale_config("DASS-21"); cfg["questions"] = make_q(21, 3)
r = scale_engine.calculate_score(cfg, {i: "1" for i in range(21)})
check("DASS-21 depression@all-1 -> 14", r.subscale_scores["depression"]["score"], 14)
check("DASS-21 anxiety@all-1 -> 14",    r.subscale_scores["anxiety"]["score"],    14)
check("DASS-21 stress@all-1 -> 14",     r.subscale_scores["stress"]["score"],     14)
check("DASS-21 grand_raw total",        r.total, 21)
d_sev = r.subscale_scores["depression"].get("severity")
check("DASS-21 dep severity@14 -> moderate", d_sev["level"] if d_sev else "none", "moderate")

# ── 8. DHI ───────────────────────────────────────────────────────────────────
cfg = get_scale_config("DHI")
cfg["questions"] = [{"options": [{"value": "0", "points": 0}, {"value": "2", "points": 2}, {"value": "4", "points": 4}]} for _ in range(25)]
r = scale_engine.calculate_score(cfg, {i: "4" for i in range(25)})
check("DHI all-Yes total", r.total, 100)
check("DHI severity@44 -> moderate", scale_engine.get_severity(cfg, 44).level, "moderate")
check("DHI severity@20 -> mild",     scale_engine.get_severity(cfg, 20).level, "mild")

# ── 9. DN4 ───────────────────────────────────────────────────────────────────
cfg = get_scale_config("DN4"); cfg["questions"] = make_q(10, 1)
r = scale_engine.calculate_score(cfg, {i: "1" for i in range(4)})
check("DN4 score=4", r.total, 4)
check("DN4 severity@4 -> likely",   scale_engine.get_severity(cfg, 4).level,  "likely")
check("DN4 severity@3 -> unlikely", scale_engine.get_severity(cfg, 3).level,  "unlikely")
flags = scale_engine.detect_risk_flags(cfg, {i: "1" for i in range(4)}, r)
check("DN4 risk flag count", len(flags), 1)

# ── 10. DSRS ─────────────────────────────────────────────────────────────────
cfg = get_scale_config("DSRS"); cfg["questions"] = make_q(12, 4)
r = scale_engine.calculate_score(cfg, {i: "2" for i in range(12)})
check("DSRS all-2 total", r.total, 24)
check("DSRS severity@24 -> moderate", scale_engine.get_severity(cfg, 24).level, "moderate")
check("DSRS severity@10 -> mild",     scale_engine.get_severity(cfg, 10).level, "mild")
check("DSRS severity@40 -> severe",   scale_engine.get_severity(cfg, 40).level, "severe")

# ── 11. FIQR ─────────────────────────────────────────────────────────────────
cfg = get_scale_config("FIQR"); cfg["questions"] = [{"options": []} for _ in range(21)]
r = scale_engine.calculate_score(cfg, {i: "10" for i in range(21)})
check("FIQR function@all-10 -> 30",  r.domain_scores["function"]["score"],  30)
check("FIQR overall@all-10 -> 20",   r.domain_scores["overall"]["score"],   20)
check("FIQR symptoms@all-10 -> 50",  r.domain_scores["symptoms"]["score"],  50)
check("FIQR total@all-10 -> 100",    r.total, 100)
r2 = scale_engine.calculate_score(cfg, {i: "5" for i in range(21)})
check("FIQR total@all-5 -> 50", r2.total, 50)

# ── 12. FSS ──────────────────────────────────────────────────────────────────
cfg = get_scale_config("FSS"); cfg["questions"] = make_q(9, 7)
r = scale_engine.calculate_score(cfg, {i: "5" for i in range(9)})
check("FSS mean@all-5 -> 5.0", r.total, 5.0)
check("FSS severity@5 -> moderate", scale_engine.get_severity(cfg, 5.0).level, "moderate")
check("FSS severity@3.9 -> normal", scale_engine.get_severity(cfg, 3.9).level, "normal")

# ── 13. GAD-7 ────────────────────────────────────────────────────────────────
cfg = get_scale_config("GAD-7"); cfg["questions"] = make_q(8, 3)
cfg["scoredQuestions"] = [0, 1, 2, 3, 4, 5, 6]
r = scale_engine.calculate_score(cfg, {i: "2" for i in range(7)})
check("GAD-7 all-2 total -> 14", r.total, 14)
check("GAD-7 severity@14 -> moderate", scale_engine.get_severity(cfg, 14).level, "moderate")
check("GAD-7 severity@17 -> severe",   scale_engine.get_severity(cfg, 17).level, "severe")
check("GAD-7 severity@3 -> minimal",   scale_engine.get_severity(cfg, 3).level,  "minimal")

# ── 14. ISI ──────────────────────────────────────────────────────────────────
cfg = get_scale_config("ISI"); cfg["questions"] = make_q(7, 4)
r = scale_engine.calculate_score(cfg, {i: "3" for i in range(7)})
check("ISI all-3 total -> 21", r.total, 21)
check("ISI severity@21 -> moderate", scale_engine.get_severity(cfg, 21).level, "moderate")
check("ISI severity@26 -> severe",   scale_engine.get_severity(cfg, 26).level, "severe")
check("ISI severity@5 -> none",      scale_engine.get_severity(cfg, 5).level,  "none")

# ── 15. MADRS ────────────────────────────────────────────────────────────────
cfg = get_scale_config("MADRS"); cfg["questions"] = make_q(10, 6)
r = scale_engine.calculate_score(cfg, {i: "3" for i in range(10)})
check("MADRS all-3 total -> 30", r.total, 30)
check("MADRS severity@30 -> moderate",         scale_engine.get_severity(cfg, 30).level, "moderate")
check("MADRS severity@35 -> severe",           scale_engine.get_severity(cfg, 35).level, "severe")
check("MADRS severity@5  -> normal",           scale_engine.get_severity(cfg, 5).level,  "normal")
check("MADRS severity@45 -> extremely_severe", scale_engine.get_severity(cfg, 45).level, "extremely_severe")

# ── 16. MFIS ─────────────────────────────────────────────────────────────────
cfg = get_scale_config("MFIS"); cfg["questions"] = [{"options": []} for _ in range(21)]
r = scale_engine.calculate_score(cfg, {i: "2" for i in range(21)})
check("MFIS physical@all-2 -> 18",    r.subscale_scores["physical"]["score"], 18)
check("MFIS cognitive@all-2 -> 20",   r.subscale_scores["cognitive"]["score"], 20)
check("MFIS psychosocial@all-2 -> 4", r.subscale_scores["psychosocial"]["score"], 4)
check("MFIS total@all-2 -> 42",       r.total, 42)

# ── 17. MIDAS ────────────────────────────────────────────────────────────────
cfg = get_scale_config("MIDAS"); cfg["questions"] = make_q(7, 90)
cfg["scoredQuestions"] = [0, 1, 2, 3, 4]
r = scale_engine.calculate_score(cfg, {0: 5, 1: 5, 2: 5, 3: 5, 4: 5})
check("MIDAS 5x5=25", r.total, 25)
check("MIDAS severity@25 -> grade4", scale_engine.get_severity(cfg, 25).level, "grade4")
check("MIDAS severity@8  -> grade2", scale_engine.get_severity(cfg, 8).level,  "grade2")
check("MIDAS severity@3  -> grade1", scale_engine.get_severity(cfg, 3).level,  "grade1")

# ── 18. MSQ transformed ──────────────────────────────────────────────────────
cfg = get_scale_config("MSQ"); cfg["questions"] = [{"options": []} for _ in range(14)]
r = scale_engine.calculate_score(cfg, {i: "6" for i in range(14)})
check("MSQ role_restrictive@all-6 -> 100", r.subscale_scores["role_restrictive"]["score"], 100)
check("MSQ total@all-6 -> 300", r.total, 300)
r2 = scale_engine.calculate_score(cfg, {i: "1" for i in range(14)})
check("MSQ all-min -> 0", r2.total, 0)

# ── 19. Pain-Rating-Scale ────────────────────────────────────────────────────
cfg = get_scale_config("Pain-Rating-Scale"); cfg["questions"] = make_q(1, 10)
r = scale_engine.calculate_score(cfg, {0: "7"})
check("Pain NRS score=7", r.total, 7)
check("Pain severity@7 -> severe", scale_engine.get_severity(cfg, 7).level, "severe")
check("Pain severity@3 -> mild",   scale_engine.get_severity(cfg, 3).level, "mild")

# ── 20. painDETECT ───────────────────────────────────────────────────────────
cfg = get_scale_config("painDETECT"); cfg["questions"] = make_q(9, 5)
r = scale_engine.calculate_score(cfg, {i: "3" for i in range(7)})
check("painDETECT 7x3=21", r.total, 21)
check("painDETECT@21 -> likely",   r.extra.get("neuropathic_classification"), "likely")
r2 = scale_engine.calculate_score(cfg, {i: "1" for i in range(7)})
check("painDETECT 7x1=7 -> unlikely", r2.extra.get("neuropathic_classification"), "unlikely")
r3 = scale_engine.calculate_score(cfg, {i: "2" for i in range(7)})
check("painDETECT 7x2=14 -> possible", r3.extra.get("neuropathic_classification"), "possible")

# ── 21. PSQI ─────────────────────────────────────────────────────────────────
cfg = get_scale_config("PSQI"); cfg["questions"] = [{"options": []} for _ in range(19)]
resp = {i: "0" for i in range(19)}
resp[17] = "2"   # comp1 = 2
resp[14] = "1"   # comp6 = 1
resp[3]  = "4"   # comp3: 4hrs -> 3
r = scale_engine.calculate_score(cfg, resp)
check("PSQI comp1=2",        r.component_scores["1"]["score"], 2)
check("PSQI comp3@4hrs->3",  r.component_scores["3"]["score"], 3)
check("PSQI comp6=1",        r.component_scores["6"]["score"], 1)
# bed=0h wake=0h → overnight wrap (24h in bed), asleep=4h → eff=16.7% → comp4=3; total=2+0+3+3+0+1+0=9
check("PSQI total=9",        r.total, 9)
check("PSQI severity@6 -> moderate", scale_engine.get_severity(cfg, 6).level, "moderate")
check("PSQI severity@4 -> good",     scale_engine.get_severity(cfg, 4).level, "good")

# ── 22. SARA ─────────────────────────────────────────────────────────────────
cfg = get_scale_config("SARA"); cfg["questions"] = make_q(8, 5)
r = scale_engine.calculate_score(cfg, {i: "3" for i in range(8)})
check("SARA all-3 total -> 24", r.total, 24)
check("SARA severity@24 -> severe", scale_engine.get_severity(cfg, 24).level, "severe")
check("SARA severity@8  -> mild",   scale_engine.get_severity(cfg, 8).level,  "mild")
check("SARA severity@2  -> normal", scale_engine.get_severity(cfg, 2).level,  "normal")

# ── 23. SNAP-IV ──────────────────────────────────────────────────────────────
cfg = get_scale_config("SNAP-IV"); cfg["questions"] = [{"options": []} for _ in range(26)]
r = scale_engine.calculate_score(cfg, {i: "3" for i in range(26)})
check("SNAP-IV inattention@all-3 -> 27",   r.subscale_scores["inattention"]["score"], 27)
check("SNAP-IV hyperactivity@all-3 -> 27", r.subscale_scores["hyperactivity"]["score"], 27)
check("SNAP-IV opposition@all-3 -> 24",    r.subscale_scores["opposition"]["score"], 24)
in_sev = r.subscale_scores["inattention"].get("severity")
check("SNAP-IV inattention@27 -> severe", in_sev["level"] if in_sev else "none", "severe")

# ── 24. THI ──────────────────────────────────────────────────────────────────
cfg = get_scale_config("THI")
cfg["questions"] = [{"options": [{"value": "0", "points": 0}, {"value": "2", "points": 2}, {"value": "4", "points": 4}]} for _ in range(25)]
r = scale_engine.calculate_score(cfg, {i: "4" for i in range(25)})
check("THI all-Yes total -> 100", r.total, 100)
check("THI severity@70 -> severe",       scale_engine.get_severity(cfg, 70).level, "severe")
check("THI severity@10 -> slight",       scale_engine.get_severity(cfg, 10).level, "slight")
check("THI severity@90 -> catastrophic", scale_engine.get_severity(cfg, 90).level, "catastrophic")

# ── 25. VVAS-Ataxia ──────────────────────────────────────────────────────────
cfg = get_scale_config("VVAS-Ataxia"); cfg["questions"] = [{"options": []} for _ in range(9)]
r = scale_engine.calculate_score(cfg, {i: "7" for i in range(9)})
check("VVAS all-7 -> 70.0", r.total, 70.0)
check("VVAS severity@70 -> moderate", scale_engine.get_severity(cfg, 70).level, "moderate")
r2 = scale_engine.calculate_score(cfg, {i: "10" for i in range(9)})
check("VVAS all-10 -> 100.0", r2.total, 100.0)

# ── 26. PHQ-9 suicidal risk flag ─────────────────────────────────────────────
cfg = get_scale_config("PHQ-9"); cfg["questions"] = make_q(9, 3)
resp_risk = {i: "0" for i in range(9)}; resp_risk[8] = "2"
r_risk = scale_engine.calculate_score(cfg, resp_risk)
flags = scale_engine.detect_risk_flags(cfg, resp_risk, r_risk)
check("PHQ-9 Q9 risk flag triggered", len(flags), 1)
check("PHQ-9 risk flag priority -> critical", flags[0].priority, "critical")
resp_safe = {i: "1" for i in range(9)}; resp_safe[8] = "0"
r_safe = scale_engine.calculate_score(cfg, resp_safe)
flags_safe = scale_engine.detect_risk_flags(cfg, resp_safe, r_safe)
check("PHQ-9 Q9=0 no flag", len(flags_safe), 0)

# ── 27. IBS-SSS severity bands ───────────────────────────────────────────────
cfg = get_scale_config("IBS-SSS")
check("IBS-SSS severity@200 -> moderate", scale_engine.get_severity(cfg, 200).level, "moderate")
check("IBS-SSS severity@350 -> severe",   scale_engine.get_severity(cfg, 350).level, "severe")
check("IBS-SSS severity@50  -> remission", scale_engine.get_severity(cfg, 50).level, "remission")

# ── 28. RAADS-14 cutoff ──────────────────────────────────────────────────────
cfg = get_scale_config("RAADS-14")
check("RAADS-14 severity@14 -> likely",   scale_engine.get_severity(cfg, 14).level, "likely")
check("RAADS-14 severity@10 -> unlikely", scale_engine.get_severity(cfg, 10).level, "unlikely")

# ── 29. KPS severity ─────────────────────────────────────────────────────────
cfg = get_scale_config("KPS")
check("KPS severity@90 -> normal", scale_engine.get_severity(cfg, 90).level, "normal")
check("KPS severity@40 -> severe", scale_engine.get_severity(cfg, 40).level, "severe")

# ── 30. Disease engine — full depression-anxiety ─────────────────────────────
scale_results = {
    "BDI-II":     {"total": 30, "max_possible": 63},
    "GAD-7":      {"total": 10, "max_possible": 21},
    "DASS-21":    {"total": 28, "max_possible": 63},
    "MADRS":      {"total": 22, "max_possible": 60},
    "PSQI":       {"total": 12, "max_possible": 21},
    "COMPASS-31": {"total": 45, "max_possible": 100},
    "EQ-5D-5L":   {"total": 60, "max_possible": 100},
}
dr = disease_engine.calculate("depression-anxiety", scale_results)
check("Disease all-scales used -> 7", dr.scales_used, 7)
check("Disease severity -> moderate", dr.severity_level, "moderate")
check("Disease score 40-60", 40 <= dr.disease_score <= 60, True)

# ── 31. Disease engine — partial scales re-weighting ────────────────────────
partial = {"BDI-II": {"total": 50, "max_possible": 63}, "GAD-7": {"total": 18, "max_possible": 21}}
dr2 = disease_engine.calculate("depression-anxiety", partial)
check("Disease partial scales_used=2", dr2.scales_used, 2)
check("Disease partial score > 70",    dr2.disease_score > 70, True)
ew = dr2.scale_breakdown["BDI-II"]["effective_weight"] + dr2.scale_breakdown["GAD-7"]["effective_weight"]
check("Disease partial weights sum to 1", abs(ew - 1.0) < 0.001, True)

# ── 32. SS-QOL ───────────────────────────────────────────────────────────────
cfg = get_scale_config("SS-QOL"); cfg["questions"] = [{"options": []} for _ in range(49)]
r = scale_engine.calculate_score(cfg, {i: "5" for i in range(49)})
check("SS-QOL all-5 total -> 245", r.total, 245)
check("SS-QOL mobility avg -> 5", r.domain_scores["mobility"]["avg"], 5.0)

# ── 33. SLEEP-50 subscales ───────────────────────────────────────────────────
cfg = get_scale_config("SLEEP-50"); cfg["questions"] = [{"options": []} for _ in range(50)]
r = scale_engine.calculate_score(cfg, {i: "2" for i in range(50)})
check("SLEEP-50 insomnia@all-2 -> 18",    r.subscale_scores["insomnia"]["score"], 18)
check("SLEEP-50 sleep_apnea@all-2 -> 16", r.subscale_scores["sleep_apnea"]["score"], 16)

# ──────────────────────────────────────────────────────────────────────────────
total_tests = passed + failed
accuracy = passed / total_tests * 100 if total_tests else 0

print(f"\n{'='*60}")
print(f"  SCORING ENGINE ACCURACY REPORT")
print(f"{'='*60}")
print(f"  Total tests : {total_tests}")
print(f"  Passed      : {passed}")
print(f"  Failed      : {failed}")
print(f"  Accuracy    : {accuracy:.1f}%")
print(f"{'='*60}\n")

for line in results:
    print(line)

sys.exit(0 if failed == 0 else 1)
