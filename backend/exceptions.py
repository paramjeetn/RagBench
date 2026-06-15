"""Custom exceptions for the RAG Eval System."""


class RAGEvalError(Exception):
    """Base exception for all RAG Eval errors."""

    def __init__(self, message: str = "An internal error occurred", status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ProjectNotFoundError(RAGEvalError):
    def __init__(self, message: str = "Project not found"):
        super().__init__(message=message, status_code=404)


class DocumentNotFoundError(RAGEvalError):
    def __init__(self, message: str = "Document not found"):
        super().__init__(message=message, status_code=404)


class DatasetNotFoundError(RAGEvalError):
    def __init__(self, message: str = "Dataset not found"):
        super().__init__(message=message, status_code=404)


class EvalRunNotFoundError(RAGEvalError):
    def __init__(self, message: str = "Evaluation run not found"):
        super().__init__(message=message, status_code=404)


class EvalResultNotFoundError(RAGEvalError):
    def __init__(self, message: str = "Evaluation result not found"):
        super().__init__(message=message, status_code=404)


class IngestionError(RAGEvalError):
    def __init__(self, message: str = "Document ingestion failed"):
        super().__init__(message=message, status_code=500)


class EmbeddingError(RAGEvalError):
    def __init__(self, message: str = "Embedding generation failed"):
        super().__init__(message=message, status_code=500)


class RetrievalError(RAGEvalError):
    def __init__(self, message: str = "Retrieval failed"):
        super().__init__(message=message, status_code=500)


class GenerationError(RAGEvalError):
    def __init__(self, message: str = "Answer generation failed"):
        super().__init__(message=message, status_code=500)


class EvaluationError(RAGEvalError):
    def __init__(self, message: str = "Evaluation failed"):
        super().__init__(message=message, status_code=500)


class ConfigError(RAGEvalError):
    def __init__(self, message: str = "Invalid configuration"):
        super().__init__(message=message, status_code=400)


class VectorStoreError(RAGEvalError):
    def __init__(self, message: str = "Vector store operation failed"):
        super().__init__(message=message, status_code=500)
