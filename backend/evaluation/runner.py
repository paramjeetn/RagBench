"""Evaluation runner — executes an eval run asynchronously.

Loads QA pairs from a dataset, runs each question through the query
pipeline, scores the results, and persists everything to the database.
"""

import logging
import time
from uuid import UUID

from database import repository as repo
from evaluation.metrics import MetricScores, aggregate_metrics, compute_metrics
from exceptions import EvaluationError

logger = logging.getLogger(__name__)


class EvalRunner:
    """Drives a full evaluation run against a QueryPipeline."""

    def __init__(self, query_pipeline):
        """
        Parameters
        ----------
        query_pipeline : QueryPipeline
            An instance of ``query_pipeline.QueryPipeline`` used to generate
            answers for each test-case question.
        """
        self.query_pipeline = query_pipeline

    async def run(
        self,
        run_id: str,
        dataset_id: str,
        document_ids: list[str],
        session_factory,
    ) -> None:
        """Execute an evaluation run asynchronously.

        This is designed to be called via ``asyncio.create_task``.  It loads
        QA pairs from the dataset, queries the pipeline for each one,
        computes metrics, and writes per-question results plus the
        aggregated summary back to the database.

        Parameters
        ----------
        run_id : str
            UUID (as string) of the ``EvalRun`` row that was already created.
        dataset_id : str
            UUID (as string) of the ``Dataset`` to evaluate against.
        document_ids : list[str]
            Document scope for retrieval (may be empty for all docs).
        session_factory : async context-manager
            Callable that returns an ``AsyncSession`` (e.g.
            ``async_sessionmaker``).
        """
        run_uuid = UUID(run_id)
        dataset_uuid = UUID(dataset_id)

        try:
            async with session_factory() as session:
                # Load dataset with test cases
                dataset = await repo.get_dataset(session, dataset_uuid)
                if not dataset:
                    raise EvaluationError(f"Dataset {dataset_id} not found")

                # Load run config snapshot for config-sensitive heuristic scoring
                run_record = await repo.get_eval_run(session, run_uuid)
                run_config = run_record.config if run_record else None

                test_cases = dataset.test_cases
                total = len(test_cases)

                # Initialise progress
                await repo.update_eval_run_progress(session, run_uuid, 0)
                await session.commit()

                all_scores: list[MetricScores] = []
                run_scoring_mode: str | None = None

                for i, tc in enumerate(test_cases):
                    try:
                        # Run question through the pipeline
                        start = time.time()
                        response = await self.query_pipeline.query(
                            tc.question, document_ids or None
                        )
                        latency_ms = int((time.time() - start) * 1000)

                        # Extract chunk texts for metric computation
                        chunk_texts = [s["text"] for s in response.sources]

                        # Compute metrics (pass config so heuristic scoring is config-sensitive)
                        scores, scoring_mode = await compute_metrics(
                            question=tc.question,
                            ground_truth=tc.ground_truth,
                            generated_answer=response.answer,
                            retrieved_chunks=chunk_texts,
                            config=run_config,
                        )
                        if run_scoring_mode is None:
                            run_scoring_mode = scoring_mode
                        all_scores.append(scores)

                        # Persist per-question result
                        await repo.create_eval_result(
                            session,
                            run_id=run_uuid,
                            question=tc.question,
                            ground_truth=tc.ground_truth,
                            generated_answer=response.answer,
                            retrieved_chunks=response.sources,
                            metrics=scores.to_dict(),
                            latency_ms=latency_ms,
                            tokens_used=response.metadata.get("tokens_used", 0),
                            passed=scores.passed(),
                            failure_reason=scores.failure_reason(),
                        )

                        # Update progress
                        await repo.update_eval_run_progress(
                            session, run_uuid, i + 1
                        )
                        await session.commit()

                    except Exception as e:
                        logger.error(
                            "Error evaluating question %d/%d: %s", i + 1, total, e
                        )
                        # Store a failed result so the run still records this case
                        await repo.create_eval_result(
                            session,
                            run_id=run_uuid,
                            question=tc.question,
                            ground_truth=tc.ground_truth,
                            generated_answer=f"Error: {e}",
                            retrieved_chunks=[],
                            metrics={
                                "faithfulness": 0,
                                "answer_relevancy": 0,
                                "contextual_precision": 0,
                                "contextual_recall": 0,
                                "contextual_relevancy": 0,
                            },
                            latency_ms=0,
                            tokens_used=0,
                            passed=False,
                            failure_reason=str(e),
                        )
                        all_scores.append(MetricScores(0, 0, 0, 0, 0))
                        await repo.update_eval_run_progress(
                            session, run_uuid, i + 1
                        )
                        await session.commit()

                # Aggregate scores and mark the run as completed
                aggregated = aggregate_metrics(all_scores)
                await repo.update_eval_run_complete(
                    session, run_uuid, "completed", aggregated,
                    scoring_mode=run_scoring_mode,
                )
                await session.commit()

                logger.info("Eval run %s completed: %s", run_id, aggregated)

        except Exception as e:
            logger.error("Eval run %s failed: %s", run_id, e)
            try:
                async with session_factory() as session:
                    await repo.update_eval_run_complete(
                        session, run_uuid, "failed", None
                    )
                    await session.commit()
            except Exception:
                logger.error(
                    "Failed to update run %s status to failed", run_id
                )
