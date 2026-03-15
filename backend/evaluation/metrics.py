"""RAG evaluation metrics.

Uses deepeval for LLM-based evaluation when available, with a fallback
to simple heuristic scoring based on text overlap.
"""

from dataclasses import dataclass

METRIC_NAMES = [
    "faithfulness",
    "answer_relevancy",
    "contextual_precision",
    "contextual_recall",
    "contextual_relevancy",
]
PASS_THRESHOLD = 0.7


@dataclass
class MetricScores:
    faithfulness: float
    answer_relevancy: float
    contextual_precision: float
    contextual_recall: float
    contextual_relevancy: float

    def to_dict(self) -> dict:
        return {
            "faithfulness": round(self.faithfulness, 4),
            "answer_relevancy": round(self.answer_relevancy, 4),
            "contextual_precision": round(self.contextual_precision, 4),
            "contextual_recall": round(self.contextual_recall, 4),
            "contextual_relevancy": round(self.contextual_relevancy, 4),
        }

    def passed(self) -> bool:
        return all(
            v >= PASS_THRESHOLD
            for v in [
                self.faithfulness,
                self.answer_relevancy,
                self.contextual_precision,
                self.contextual_recall,
                self.contextual_relevancy,
            ]
        )

    def failure_reason(self) -> str | None:
        if self.passed():
            return None
        failures = []
        for name in METRIC_NAMES:
            val = getattr(self, name)
            if val < PASS_THRESHOLD:
                failures.append(f"Low {name} ({val:.2f})")
        return " — ".join(failures)


async def compute_metrics(
    question: str,
    ground_truth: str,
    generated_answer: str,
    retrieved_chunks: list[str],
) -> MetricScores:
    """Compute RAG evaluation metrics. Tries deepeval first, falls back to heuristic."""
    try:
        return await _compute_deepeval(
            question, ground_truth, generated_answer, retrieved_chunks
        )
    except Exception:
        return _compute_heuristic(
            question, ground_truth, generated_answer, retrieved_chunks
        )


async def _compute_deepeval(
    question: str,
    ground_truth: str,
    generated_answer: str,
    retrieved_chunks: list[str],
) -> MetricScores:
    """Use deepeval library for proper LLM-based evaluation."""
    import asyncio

    from deepeval.metrics import (
        AnswerRelevancyMetric,
        ContextualPrecisionMetric,
        ContextualRecallMetric,
        ContextualRelevancyMetric,
        FaithfulnessMetric,
    )
    from deepeval.test_case import LLMTestCase

    test_case = LLMTestCase(
        input=question,
        actual_output=generated_answer,
        expected_output=ground_truth,
        retrieval_context=retrieved_chunks,
    )

    metrics = [
        FaithfulnessMetric(threshold=PASS_THRESHOLD),
        AnswerRelevancyMetric(threshold=PASS_THRESHOLD),
        ContextualPrecisionMetric(threshold=PASS_THRESHOLD),
        ContextualRecallMetric(threshold=PASS_THRESHOLD),
        ContextualRelevancyMetric(threshold=PASS_THRESHOLD),
    ]

    # Run all metrics (deepeval metrics are sync, so offload to thread)
    for metric in metrics:
        await asyncio.to_thread(metric.measure, test_case)

    return MetricScores(
        faithfulness=metrics[0].score,
        answer_relevancy=metrics[1].score,
        contextual_precision=metrics[2].score,
        contextual_recall=metrics[3].score,
        contextual_relevancy=metrics[4].score,
    )


def _compute_heuristic(
    question: str,
    ground_truth: str,
    generated_answer: str,
    retrieved_chunks: list[str],
) -> MetricScores:
    """Simple heuristic scoring when deepeval is unavailable. Based on text overlap."""
    from difflib import SequenceMatcher

    # Answer-ground truth similarity
    answer_sim = SequenceMatcher(
        None, generated_answer.lower(), ground_truth.lower()
    ).ratio()

    # Context-answer overlap (faithfulness proxy)
    context_text = " ".join(retrieved_chunks).lower()
    answer_words = set(generated_answer.lower().split())
    context_words = set(context_text.split())
    if answer_words:
        faithfulness = len(answer_words & context_words) / len(answer_words)
    else:
        faithfulness = 0.0

    # Context-question relevancy
    stop_words = {
        "the", "a", "an", "is", "are", "was", "were",
        "how", "what", "why", "when", "where", "which", "do", "does",
    }
    question_words = set(question.lower().split()) - stop_words
    if question_words:
        context_relevancy = len(question_words & context_words) / len(question_words)
    else:
        context_relevancy = 0.0

    # Ground truth coverage in context (recall proxy)
    gt_words = set(ground_truth.lower().split())
    if gt_words:
        recall = len(gt_words & context_words) / len(gt_words)
    else:
        recall = 0.0

    return MetricScores(
        faithfulness=min(faithfulness, 1.0),
        answer_relevancy=answer_sim,
        contextual_precision=min(context_relevancy * 1.2, 1.0),
        contextual_recall=min(recall, 1.0),
        contextual_relevancy=min(context_relevancy, 1.0),
    )


def aggregate_metrics(scores_list: list[MetricScores]) -> dict:
    """Average all metric scores across multiple test cases."""
    if not scores_list:
        return {name: 0.0 for name in METRIC_NAMES}

    result = {}
    for name in METRIC_NAMES:
        values = [getattr(s, name) for s in scores_list]
        result[name] = round(sum(values) / len(values), 4)
    return result
