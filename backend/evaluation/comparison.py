"""Compare two evaluation runs to surface metric deltas and insights."""


def compare_runs(run_a: dict, run_b: dict) -> dict:
    """Compare two eval runs.

    Each run dict should have at minimum: ``id``, ``dataset_name``,
    ``config``, ``metrics``.

    Returns a dict with the two runs, metric deltas (B - A), a list of
    config field differences, and human-readable insights.
    """
    metrics_a = run_a.get("metrics", {}) or {}
    metrics_b = run_b.get("metrics", {}) or {}

    # Compute deltas (B - A)
    all_metric_names = set(list(metrics_a.keys()) + list(metrics_b.keys()))
    deltas = {}
    for name in all_metric_names:
        val_a = metrics_a.get(name, 0)
        val_b = metrics_b.get(name, 0)
        deltas[name] = round(val_b - val_a, 4)

    # Config diff
    config_a = run_a.get("config", {}) or {}
    config_b = run_b.get("config", {}) or {}
    config_diff = _compute_config_diff(config_a, config_b)

    # Generate insights
    insights = _generate_insights(deltas, config_diff)

    return {
        "run_a": {
            "id": run_a["id"],
            "dataset_name": run_a.get("dataset_name", ""),
            "config": config_a,
            "metrics": metrics_a,
        },
        "run_b": {
            "id": run_b["id"],
            "dataset_name": run_b.get("dataset_name", ""),
            "config": config_b,
            "metrics": metrics_b,
        },
        "deltas": deltas,
        "config_diff": config_diff,
        "insights": insights,
    }


def _compute_config_diff(
    config_a: dict, config_b: dict, prefix: str = ""
) -> list[dict]:
    """Recursively find differences between two config dicts."""
    diffs: list[dict] = []
    all_keys = set(list(config_a.keys()) + list(config_b.keys()))

    for key in sorted(all_keys):
        field = f"{prefix}{key}" if not prefix else f"{prefix}.{key}"
        val_a = config_a.get(key)
        val_b = config_b.get(key)

        if isinstance(val_a, dict) and isinstance(val_b, dict):
            diffs.extend(_compute_config_diff(val_a, val_b, field))
        elif val_a != val_b:
            diffs.append({"field": field, "value_a": val_a, "value_b": val_b})

    return diffs


def _generate_insights(deltas: dict, config_diff: list[dict]) -> list[str]:
    """Generate human-readable insights from metric deltas and config changes."""
    insights: list[str] = []

    # Map config changes to metric impacts
    config_changes = {d["field"]: d for d in config_diff}

    # --- Faithfulness ---
    if "faithfulness" in deltas:
        delta = deltas["faithfulness"]
        if abs(delta) > 0.05:
            direction = "improved" if delta > 0 else "dropped"
            insight = f"Faithfulness {direction} {delta:+.2f}"
            if "retrieval.reranker_enabled" in config_changes:
                insight += (
                    ". Reranker change likely filtered out irrelevant "
                    "context, reducing hallucination."
                )
            elif "generation.model" in config_changes:
                model_a = config_changes["generation.model"]["value_a"]
                model_b = config_changes["generation.model"]["value_b"]
                insight += f". Model changed from {model_a} to {model_b}."
            insights.append(insight)

    # --- Contextual Precision ---
    if "contextual_precision" in deltas:
        delta = deltas["contextual_precision"]
        if abs(delta) > 0.05:
            direction = "improved" if delta > 0 else "dropped"
            insight = f"Contextual Precision {direction} {delta:+.2f}"
            if "chunking.strategy" in config_changes:
                strat_a = config_changes["chunking.strategy"]["value_a"]
                strat_b = config_changes["chunking.strategy"]["value_b"]
                insight += (
                    f". Switching from {strat_a} to {strat_b} chunking "
                    "affects boundary quality."
                )
            if "retrieval.reranker_enabled" in config_changes:
                insight += " Reranker helps rank relevant chunks higher."
            insights.append(insight)

    # --- Contextual Recall ---
    if "contextual_recall" in deltas:
        delta = deltas["contextual_recall"]
        if abs(delta) > 0.05:
            direction = "improved" if delta > 0 else "dropped"
            insight = f"Contextual Recall {direction} {delta:+.2f}"
            if "retrieval.mode" in config_changes:
                mode_a = config_changes["retrieval.mode"]["value_a"]
                mode_b = config_changes["retrieval.mode"]["value_b"]
                insight += (
                    f". Retrieval mode changed from {mode_a} to {mode_b}."
                )
            if "retrieval.top_k" in config_changes:
                topk_a = config_changes["retrieval.top_k"]["value_a"]
                topk_b = config_changes["retrieval.top_k"]["value_b"]
                insight += f" top_k changed from {topk_a} to {topk_b}."
            insights.append(insight)

    # --- Answer Relevancy ---
    if "answer_relevancy" in deltas:
        delta = deltas["answer_relevancy"]
        if abs(delta) > 0.05:
            direction = "improved" if delta > 0 else "dropped"
            insights.append(
                f"Answer Relevancy {direction} {delta:+.2f}. "
                "Check prompt template and context quality."
            )

    # --- Contextual Relevancy ---
    if "contextual_relevancy" in deltas:
        delta = deltas["contextual_relevancy"]
        if abs(delta) > 0.05:
            direction = "improved" if delta > 0 else "dropped"
            insight = f"Contextual Relevancy {direction} {delta:+.2f}"
            if "chunking.chunk_size" in config_changes:
                cs_a = config_changes["chunking.chunk_size"]["value_a"]
                cs_b = config_changes["chunking.chunk_size"]["value_b"]
                insight += f". Chunk size changed from {cs_a} to {cs_b}."
            insights.append(insight)

    # --- Trade-off warnings ---
    if "retrieval.reranker_enabled" in config_changes:
        reranker_b = config_changes["retrieval.reranker_enabled"]["value_b"]
        if reranker_b:
            insights.append(
                "Trade-off: expect ~0.3s added latency and ~2x token "
                "cost per query from reranking."
            )

    if not insights:
        insights.append(
            "No significant metric changes detected between the two runs."
        )

    return insights
