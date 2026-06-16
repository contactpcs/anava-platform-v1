"""
ScaleEngine — individual scale scoring.

All scoring logic is derived from:
  'Scoring caluculation for each scale in detail.docx'
  (D:/PCS/Scales pdfs/)

The engine is stateless; a singleton is exported at the bottom.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ScoreResult:
    total: float
    max_possible: float
    question_scores: Dict[int, float] = field(default_factory=dict)
    subscale_scores: Dict[str, Any]   = field(default_factory=dict)
    domain_scores:   Dict[str, Any]   = field(default_factory=dict)
    component_scores: Dict[str, Any]  = field(default_factory=dict)
    extra: Dict[str, Any]             = field(default_factory=dict)


@dataclass
class SeverityResult:
    level: str
    label: str
    description: str = ""
    min_score: float = 0
    max_score: float = 0


@dataclass
class RiskFlag:
    message: str
    priority: str = "moderate"
    question_index: Optional[int] = None
    value: Any = None
    source: str = ""


# ---------------------------------------------------------------------------
# ScaleEngine
# ---------------------------------------------------------------------------

class ScaleEngine:

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def calculate_score(
        self, scale_config: dict, responses: Dict[int, Any]
    ) -> ScoreResult:
        scoring_type = (
            scale_config.get("scoringType")
            or scale_config.get("scoringMethod")
            or "sum"
        )
        method = f"_score_{scoring_type.replace('-', '_')}"
        handler = getattr(self, method, self._score_sum)
        return handler(responses, scale_config)

    def get_severity(
        self, scale_config: dict, total_score: float
    ) -> Optional[SeverityResult]:
        bands = scale_config.get("severityBands", [])
        for band in bands:
            mn = band.get("min", 0)
            mx = band.get("max", math.inf)
            if mn <= total_score <= mx:
                return SeverityResult(
                    level=band.get("level", "unknown"),
                    label=band.get("label", ""),
                    description=band.get("description", ""),
                    min_score=mn,
                    max_score=mx,
                )
        return None

    def detect_risk_flags(
        self,
        scale_config: dict,
        responses: Dict[int, Any],
        score_result: ScoreResult,
    ) -> List[RiskFlag]:
        flags: List[RiskFlag] = []
        scale_id = scale_config.get("id", "")

        for rule in scale_config.get("riskRules", []):
            rule_type = rule.get("type", "threshold")

            if rule_type == "item_threshold":
                q_idx = rule.get("questionIndex")
                if q_idx is not None and q_idx in responses:
                    val = self._to_float(responses[q_idx])
                    if val is not None and self._compare(
                        val, rule.get("operator", ">="), rule.get("threshold", 0)
                    ):
                        flags.append(RiskFlag(
                            message=rule.get("message", f"Risk on Q{q_idx}"),
                            priority=rule.get("priority", "moderate"),
                            question_index=q_idx,
                            value=val,
                            source=scale_id,
                        ))

            elif rule_type == "total_threshold":
                val = score_result.total
                if self._compare(val, rule.get("operator", ">="), rule.get("threshold", 0)):
                    flags.append(RiskFlag(
                        message=rule.get("message", "Score exceeds risk threshold"),
                        priority=rule.get("priority", "moderate"),
                        value=val,
                        source=scale_id,
                    ))

        return flags

    # ------------------------------------------------------------------ #
    # SCORING HANDLERS                                                     #
    # ------------------------------------------------------------------ #

    # --- Generic sum --------------------------------------------------------

    def _score_sum(self, responses: dict, config: dict) -> ScoreResult:
        """Plain sum over all scored questions."""
        total = 0.0
        question_scores: Dict[int, float] = {}
        scored_qs = config.get("scoredQuestions")

        for i, question in enumerate(config.get("questions", [])):
            if scored_qs is not None and i not in scored_qs:
                continue
            if not self._is_scored(question):
                continue
            val = responses.get(i)
            if val is not None and val != "":
                num = self._to_float(val)
                if num is not None:
                    pts = self._get_option_points(question, val, num)
                    total += pts
                    question_scores[i] = pts

        return ScoreResult(
            total=round(total, 2),
            max_possible=config.get("maxScore") or self._calc_max_score(config),
            question_scores=question_scores,
        )

    def _score_sum_numeric(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_sum(responses, config)

    def _score_weighted_sum(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_sum(responses, config)

    def _score_nrs(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_sum(responses, config)

    def _score_clinician(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_sum(responses, config)

    def _score_single_selection(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_sum(responses, config)

    # --- Mean ---------------------------------------------------------------

    def _score_mean(self, responses: dict, config: dict) -> ScoreResult:
        result = self._score_sum(responses, config)
        answered = len([v for v in result.question_scores.values() if v is not None])
        if answered > 0:
            result.total = round(result.total / answered, 2)
        return result

    def _score_vas_mean(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_mean(responses, config)

    # --- Binary cutoff ------------------------------------------------------

    def _score_binary_cutoff(self, responses: dict, config: dict) -> ScoreResult:
        result = self._score_sum(responses, config)
        cutoff = config.get("cutoff")
        result.extra["is_positive"] = (
            result.total >= cutoff if cutoff is not None else None
        )
        result.extra["cutoff"] = cutoff
        return result

    # --- Reverse scored -----------------------------------------------------

    def _score_reverse_scored(self, responses: dict, config: dict) -> ScoreResult:
        total = 0.0
        question_scores: Dict[int, float] = {}
        reverse_items = config.get("reverseItems", [])
        max_item = config.get("maxItemScore", 3)

        for i, question in enumerate(config.get("questions", [])):
            val = responses.get(i)
            if val is not None and val != "":
                num = self._to_float(val)
                if num is not None:
                    if i in reverse_items:
                        num = max_item - num
                    total += num
                    question_scores[i] = num

        return ScoreResult(
            total=round(total, 2),
            max_possible=config.get("maxScore") or self._calc_max_score(config),
            question_scores=question_scores,
            extra={"reverse_items": reverse_items},
        )

    # --- Subscale sum -------------------------------------------------------
    # Accepts subscales using either 'questionIndices' or 'items' field name.
    # Applies per-subscale multiplier and optional per-subscale severity bands.

    def _score_subscale_sum(self, responses: dict, config: dict) -> ScoreResult:
        subscale_scores: Dict[str, Any] = {}
        total = 0.0

        for subscale in config.get("subscales", []):
            indices = subscale.get("questionIndices") or subscale.get("items", [])
            sub_total = 0.0
            for idx in indices:
                val = responses.get(idx)
                if val is not None and val != "":
                    num = self._to_float(val)
                    if num is not None:
                        questions = config.get("questions", [])
                        q = questions[idx] if idx < len(questions) else {}
                        pts = self._get_option_points(q, val, num)
                        sub_total += pts

            multiplier = subscale.get("multiplier", 1)
            final = round(sub_total * multiplier, 2)
            sub_id = subscale["id"]
            subscale_scores[sub_id] = {
                "name":       subscale.get("name", ""),
                "raw":        sub_total,
                "multiplier": multiplier,
                "score":      final,
            }
            sev_bands = subscale.get("severityBands")
            if sev_bands:
                sev = self.get_severity({"severityBands": sev_bands}, final)
                subscale_scores[sub_id]["severity"] = sev.__dict__ if sev else None

            total += final

        return ScoreResult(
            total=round(total, 2),
            max_possible=config.get("maxScore", 0),
            subscale_scores=subscale_scores,
        )

    # Aliases covering every scoringType name that maps to subscale-sum logic
    def _score_sum_subscales(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_subscale_sum(responses, config)

    def _score_subscale_severity(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_subscale_sum(responses, config)

    def _score_pfs_dual(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_subscale_sum(responses, config)

    # --- DASS-21 (subscales × 2, separate severity per subscale) -----------

    def _score_dass21(self, responses: dict, config: dict) -> ScoreResult:
        """
        DASS-21: each of 3 subscales scores = raw sum × 2.
        Total = sum of all 21 raw item responses (before × 2).
        """
        subscale_scores: Dict[str, Any] = {}
        grand_raw = 0.0
        question_scores: Dict[int, float] = {}

        for subscale in config.get("subscales", []):
            indices = subscale.get("questionIndices") or subscale.get("items", [])
            sub_raw = 0.0
            for idx in indices:
                val = responses.get(idx)
                if val is not None and val != "":
                    num = self._to_float(val)
                    if num is not None:
                        questions = config.get("questions", [])
                        q = questions[idx] if idx < len(questions) else {}
                        pts = self._get_option_points(q, val, num)
                        sub_raw += pts
                        grand_raw += pts
                        question_scores[idx] = pts

            multiplier = subscale.get("multiplier", 2)
            subscale_score = round(sub_raw * multiplier, 2)
            sub_id = subscale["id"]
            subscale_scores[sub_id] = {
                "name":       subscale.get("name", ""),
                "raw":        sub_raw,
                "multiplier": multiplier,
                "score":      subscale_score,
            }
            sev_bands = subscale.get("severityBands")
            if sev_bands:
                sev = self.get_severity({"severityBands": sev_bands}, subscale_score)
                subscale_scores[sub_id]["severity"] = sev.__dict__ if sev else None

        return ScoreResult(
            total=round(grand_raw, 2),
            max_possible=config.get("maxScore", 63),
            question_scores=question_scores,
            subscale_scores=subscale_scores,
        )

    # --- FIQR weighted domains ---------------------------------------------

    def _score_fiqr_weighted(self, responses: dict, config: dict) -> ScoreResult:
        """
        FIQR: 3 domains (Function÷3, Overall÷1, Symptoms÷2), total 0-100.
        Domains use 'items' key (not questionIndices).
        """
        domains = config.get("domains", {})
        domain_scores: Dict[str, Any] = {}
        total = 0.0

        for domain_id, domain in domains.items():
            raw = 0.0
            answered = 0
            for idx in domain.get("items", []):
                val = responses.get(idx)
                if val is not None and val != "":
                    num = self._to_float(val)
                    if num is not None:
                        raw += num
                        answered += 1

            divisor = domain.get("divisor", 1)
            score = round(raw / divisor, 2) if divisor else 0
            domain_scores[domain_id] = {
                "name":         domain.get("name", ""),
                "raw":          raw,
                "divisor":      divisor,
                "score":        score,
                "items_answered": answered,
                "total_items":  len(domain.get("items", [])),
            }
            total += score

        return ScoreResult(
            total=round(total, 2),
            max_possible=config.get("maxScore", 100),
            domain_scores=domain_scores,
        )

    # --- COMPASS-31 weighted domain sum ------------------------------------

    def _score_compass31(self, responses: dict, config: dict) -> ScoreResult:
        """
        COMPASS-31: 6 domains, each weighted by a multiplier from the scoring doc.
        Domain items use 'questionIndices'.
        """
        domains = config.get("domains", [])
        domain_scores: Dict[str, Any] = {}
        total = 0.0

        for domain in domains:
            raw = 0.0
            indices = domain.get("questionIndices") or domain.get("items", [])
            for idx in indices:
                val = responses.get(idx)
                if val is not None and val != "":
                    num = self._to_float(val)
                    if num is not None:
                        raw += num

            multiplier = domain.get("multiplier", 1)
            weighted = round(raw * multiplier, 2)
            domain_id = domain.get("id", str(len(domain_scores)))
            domain_scores[domain_id] = {
                "name":        domain.get("name", ""),
                "raw":         raw,
                "multiplier":  multiplier,
                "weighted":    weighted,
                "max_weighted": domain.get("maxWeighted"),
            }
            total += weighted

        return ScoreResult(
            total=round(total, 2),
            max_possible=config.get("maxScore", 100),
            domain_scores=domain_scores,
        )

    # Alias for the old key used in some places
    def _score_weighted_domain_sum(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_compass31(responses, config)

    # --- MSQ transformed ---------------------------------------------------

    def _score_msq_transformed(self, responses: dict, config: dict) -> ScoreResult:
        """
        MSQ v2.1: each subscale rescaled to 0-100.
        Formula per subscale: (sum_of_responses - nItems) × 100 / (nItems × (maxPerItem - minPerItem))
        Total = sum of the three rescaled subscale scores (0-300).
        """
        subscale_scores: Dict[str, Any] = {}
        total = 0.0

        for subscale in config.get("subscales", []):
            indices = subscale.get("questionIndices") or subscale.get("items", [])
            n = subscale.get("nItems", len(indices))
            max_per = subscale.get("maxPerItem", 6)
            min_per = subscale.get("minPerItem", 1)
            raw_sum = 0.0
            answered = 0

            for idx in indices:
                val = responses.get(idx)
                if val is not None and val != "":
                    num = self._to_float(val)
                    if num is not None:
                        raw_sum += num
                        answered += 1

            denom = n * (max_per - min_per)
            if denom > 0 and answered > 0:
                rescaled = round((raw_sum - n) * 100 / denom, 2)
                rescaled = max(0.0, min(100.0, rescaled))
            else:
                rescaled = 0.0

            sub_id = subscale["id"]
            subscale_scores[sub_id] = {
                "name":     subscale.get("name", ""),
                "raw_sum":  raw_sum,
                "rescaled": rescaled,
                "score":    rescaled,
            }
            total += rescaled

        return ScoreResult(
            total=round(total, 2),
            max_possible=config.get("maxScore", 300),
            subscale_scores=subscale_scores,
            extra={"note": "Higher = better quality of life"},
        )

    # --- EQ-5D-5L profile + VAS --------------------------------------------

    def _score_profile_and_vas(self, responses: dict, config: dict) -> ScoreResult:
        """
        EQ-5D-5L: 5 dimension levels (1-5) form a profile; Q6 is the VAS (0-100).
        Primary score = VAS. Dimensions stored in extra.
        """
        dimension_scores: Dict[str, Any] = {}
        health_state = ""
        vas_score: Optional[float] = None

        for i, question in enumerate(config.get("questions", [])):
            val = responses.get(i)
            q_type = question.get("type", "")
            if q_type == "visual-analogue-scale" or question.get("dimension") is None:
                if val is not None:
                    vas_score = self._to_float(val)
            else:
                dim = question.get("dimension", f"dim_{i}")
                num = self._to_float(val) if val is not None else None
                dimension_scores[dim] = {
                    "label": question.get("question") or question.get("label", ""),
                    "level": num,
                    "max_level": 5,
                }
                health_state += str(int(num)) if num is not None else "X"

        return ScoreResult(
            total=vas_score if vas_score is not None else 0.0,
            max_possible=100,
            extra={
                "health_state_profile": health_state,
                "dimension_scores":     dimension_scores,
                "vas_score":            vas_score,
                "is_profile_based":     True,
            },
        )

    # --- PSQI component sum ------------------------------------------------

    def _score_psqi(self, responses: dict, config: dict) -> ScoreResult:
        """
        PSQI: 7 components, each scored 0-3; total 0-21.
        Component scoring logic from the Pittsburgh Sleep Quality Index manual.
        """
        component_scores: Dict[str, Any] = {}
        total = 0.0

        for comp in config.get("components", []):
            score = self._calc_psqi_component(comp, responses)
            score = max(0, min(3, score))
            comp_id = str(comp["id"])
            component_scores[comp_id] = {
                "name":      comp.get("name", f"Component {comp['id']}"),
                "score":     score,
                "max_score": 3,
            }
            total += score

        return ScoreResult(
            total=total,
            max_possible=config.get("maxScore", 21),
            component_scores=component_scores,
        )

    # Old alias kept for backward compat
    def _score_component_sum(self, responses: dict, config: dict) -> ScoreResult:
        return self._score_psqi(responses, config)

    def _calc_psqi_component(self, comp: dict, responses: dict) -> int:
        comp_type = comp.get("type", "item")

        # ---- Component 1 & 6: single item direct --------------------------
        if comp_type == "item":
            idx = comp.get("questionIndex", 0)
            val = self._to_float(responses.get(idx)) or 0
            return int(round(val))

        # ---- Component 2: sleep latency -----------------------------------
        elif comp_type == "latency_sum":
            # Step 1: categorise Q2 (minutes to fall asleep)
            lat_idx = comp.get("latencyIndex", 1)
            minutes = self._to_float(responses.get(lat_idx)) or 0
            if minutes <= 15:
                lat_cat = 0
            elif minutes <= 30:
                lat_cat = 1
            elif minutes <= 60:
                lat_cat = 2
            else:
                lat_cat = 3

            # Step 2: add Q5a raw score
            q5a_idx = comp.get("item5aIndex", 4)
            q5a_val = self._to_float(responses.get(q5a_idx)) or 0

            combined = lat_cat + q5a_val
            # Step 3: categorise combined
            for band in comp.get("scoringBands", []):
                if band["min"] <= combined <= band["max"]:
                    return band["score"]
            return 0

        # ---- Component 3: sleep duration ----------------------------------
        elif comp_type == "duration":
            idx = comp.get("questionIndex", 3)
            hours = self._to_float(responses.get(idx)) or 0
            if hours > 7:
                return 0
            elif hours >= 6:
                return 1
            elif hours >= 5:
                return 2
            else:
                return 3

        # ---- Component 4: habitual sleep efficiency -----------------------
        elif comp_type == "sleep_efficiency":
            bed_idx    = comp.get("bedtimeIndex", 0)
            wake_idx   = comp.get("waketimeIndex", 2)
            asleep_idx = comp.get("minutesAsleepIndex", 3)

            hours_asleep = self._to_float(responses.get(asleep_idx)) or 0
            # Bedtime and wake time stored as hours (float) or HH:MM string
            bed_h  = self._parse_time_to_hours(responses.get(bed_idx))
            wake_h = self._parse_time_to_hours(responses.get(wake_idx))

            if wake_h is not None and bed_h is not None:
                time_in_bed = wake_h - bed_h
                if time_in_bed <= 0:
                    time_in_bed += 24  # overnight
            else:
                time_in_bed = 0

            if time_in_bed > 0:
                efficiency = (hours_asleep / time_in_bed) * 100
            else:
                return 0

            if efficiency >= 85:
                return 0
            elif efficiency >= 75:
                return 1
            elif efficiency >= 65:
                return 2
            else:
                return 3

        # ---- Component 5 & 7: sum then categorise -------------------------
        elif comp_type == "sum_categorize":
            indices = comp.get("questionIndices", [])
            raw_sum = 0.0
            for idx in indices:
                v = self._to_float(responses.get(idx))
                if v is not None:
                    raw_sum += v
            for band in comp.get("scoringBands", []):
                if band["min"] <= raw_sum <= band["max"]:
                    return band["score"]
            return 0

        return 0

    # --- ASRS screening ----------------------------------------------------

    def _score_asrs_screening(self, responses: dict, config: dict) -> ScoreResult:
        """
        ASRS v1.1: Part A (6 items). Positive screen if ≥4 items have
        response in the 'screeningPositive' option.
        """
        part_a = config.get("partA", list(range(6)))
        threshold = config.get("screeningThreshold", 4)
        screening_positive = 0
        question_scores: Dict[int, float] = {}

        for idx in part_a:
            val = responses.get(idx)
            if val is not None:
                questions = config.get("questions", [])
                q = questions[idx] if idx < len(questions) else {}
                option = next(
                    (o for o in q.get("options", [])
                     if str(o.get("value")) == str(val)),
                    None,
                )
                if option and option.get("screeningPositive"):
                    screening_positive += 1
                    question_scores[idx] = 1
                else:
                    question_scores[idx] = 0

        return ScoreResult(
            total=screening_positive,
            max_possible=len(part_a),
            question_scores=question_scores,
            extra={
                "is_positive_screen":  screening_positive >= threshold,
                "screening_threshold": threshold,
            },
        )

    # --- FFS (Flinders Fatigue Scale) --------------------------------------

    def _score_ffs(self, responses: dict, config: dict) -> ScoreResult:
        """
        FFS: items 0-3 and 5-6 are 0-4 Likert.
        Item 4 (Q5) is a checklist: score = number of options ticked.
        Total range 0-31.
        """
        total = 0.0
        question_scores: Dict[int, float] = {}
        checklist_idx = config.get("checklistIndex", 4)

        for i, question in enumerate(config.get("questions", [])):
            val = responses.get(i)
            if val is None or val == "":
                continue

            if i == checklist_idx:
                # val may be a comma-separated string of ticked times, or a count
                pts = self._count_checklist(val)
            else:
                num = self._to_float(val)
                if num is None:
                    continue
                pts = self._get_option_points(question, val, num)

            total += pts
            question_scores[i] = pts

        return ScoreResult(
            total=min(round(total, 2), 31.0),
            max_possible=config.get("maxScore", 31),
            question_scores=question_scores,
        )

    # --- IBS-SSS -----------------------------------------------------------

    def _score_ibs_sss(self, responses: dict, config: dict) -> ScoreResult:
        """
        IBS-SSS: 5 items, each 0-100.
        Q2 (index 1) = number of days in pain × 10.
        Items stored as raw values; engine treats Q2 specially if needed.
        Total 0-500.
        """
        return self._score_sum(responses, config)

    # --- painDETECT --------------------------------------------------------

    def _score_paindetect(self, responses: dict, config: dict) -> ScoreResult:
        result = self._score_sum(responses, config)
        unlikely = config.get("cutoffUnlikely", 12)
        likely   = config.get("cutoffLikely", 19)
        t = result.total
        if t <= unlikely:
            classification = "unlikely"
        elif t >= likely:
            classification = "likely"
        else:
            classification = "possible"
        result.extra["neuropathic_classification"] = classification
        return result

    # --- VVAS-Ataxia -------------------------------------------------------

    def _score_vvas(self, responses: dict, config: dict) -> ScoreResult:
        """
        VVAS: mean of all items (each 0-10) × 10 → total 0-100.
        """
        values = []
        for i, question in enumerate(config.get("questions", [])):
            val = responses.get(i)
            if val is not None and val != "":
                num = self._to_float(val)
                if num is not None:
                    values.append(num)

        if values:
            mean_val = sum(values) / len(values)
            total = round(mean_val * 10, 2)
        else:
            total = 0.0

        return ScoreResult(
            total=total,
            max_possible=config.get("maxScore", 100),
        )

    # --- SS-QOL ------------------------------------------------------------

    def _score_ssqol(self, responses: dict, config: dict) -> ScoreResult:
        """
        SS-QOL: domain averages → unweighted average of 12 domain averages.
        Summary score = avg_of_domain_averages × 49.
        """
        domains = config.get("domains", [])
        domain_scores: Dict[str, Any] = {}
        domain_avgs: List[float] = []

        for domain in domains:
            indices = domain.get("questionIndices", [])
            vals = []
            for idx in indices:
                v = self._to_float(responses.get(idx))
                if v is not None:
                    vals.append(v)
            avg = round(sum(vals) / len(vals), 3) if vals else 0.0
            d_id = domain.get("id", "")
            domain_scores[d_id] = {
                "name":  domain.get("name", ""),
                "avg":   avg,
                "items": len(vals),
            }
            if vals:
                domain_avgs.append(avg)

        summary_avg = sum(domain_avgs) / len(domain_avgs) if domain_avgs else 0.0
        total = round(summary_avg * 49, 2)

        return ScoreResult(
            total=total,
            max_possible=config.get("maxScore", 245),
            domain_scores=domain_scores,
            extra={"summary_average": round(summary_avg, 3)},
        )

    # ------------------------------------------------------------------ #
    # HELPERS                                                             #
    # ------------------------------------------------------------------ #

    def _to_float(self, val: Any) -> Optional[float]:
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    def _is_scored(self, question: dict) -> bool:
        if question.get("scoredInTotal") is False:
            return False
        if question.get("includeInScore") is False:
            return False
        if question.get("supplementary") is True:
            return False
        return True

    def _get_option_points(self, question: dict, val: Any, default: float) -> float:
        """Return the 'points' for the chosen option, or fall back to default."""
        options = question.get("options", [])
        option = next(
            (o for o in options if str(o.get("value")) == str(val)),
            None,
        )
        if option is not None and "points" in option:
            return float(option["points"])
        return default

    def _compare(self, val: float, operator: str, threshold: float) -> bool:
        return {
            ">=": val >= threshold,
            ">":  val > threshold,
            "<=": val <= threshold,
            "<":  val < threshold,
            "==": val == threshold,
            "===": val == threshold,
        }.get(operator, False)

    def _calc_max_score(self, config: dict) -> float:
        """Derive max score from option points when not explicitly set."""
        total = 0.0
        scored_qs = config.get("scoredQuestions")
        for i, q in enumerate(config.get("questions", [])):
            if scored_qs is not None and i not in scored_qs:
                continue
            if not self._is_scored(q):
                continue
            options = q.get("options", [])
            if options:
                max_pts = max(
                    (o.get("points", o.get("value", 0)) for o in options),
                    default=0,
                )
                total += float(max_pts)
        return total

    def _parse_time_to_hours(self, val: Any) -> Optional[float]:
        """Parse bedtime/wake-time to decimal hours. Accepts float (hours) or 'HH:MM'."""
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val).strip()
        if ":" in s:
            parts = s.split(":")
            try:
                return float(parts[0]) + float(parts[1]) / 60
            except (ValueError, IndexError):
                return None
        return self._to_float(val)

    def _count_checklist(self, val: Any) -> float:
        """Count ticks in a multi-select checklist value."""
        if val is None or val == "":
            return 0
        num = self._to_float(val)
        if num is not None:
            return num
        # comma/pipe separated strings: "morning,afternoon" → 2
        if isinstance(val, str):
            return float(len([v for v in val.replace("|", ",").split(",") if v.strip()]))
        if isinstance(val, (list, tuple)):
            return float(len(val))
        return 0


# Singleton
scale_engine = ScaleEngine()
