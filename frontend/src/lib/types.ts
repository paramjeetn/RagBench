// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface DocumentResponse {
  id: string;
  filename: string;
  file_type: string;
  chunk_count: number;
  chunk_strategy: string;
  uploaded_at: string;
}

export interface ChunkItem {
  index: number;
  text: string;
}

export interface PaginatedChunks {
  items: ChunkItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface DocumentDetailResponse {
  id: string;
  filename: string;
  file_type: string;
  chunk_count: number;
  chunk_strategy: string;
  uploaded_at: string;
  chunks: PaginatedChunks;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface QueryRequest {
  question: string;
  document_ids?: string[] | null;
}

export interface SourceInfo {
  text: string;
  source_file: string;
  doc_id: string;
  page_number?: number | null;
  chunk_index?: number | null;
  score: number;
}

export interface QueryMetadata {
  latency_ms: number;
  tokens_used: number;
  estimated_cost: number;
  retrieval_mode: string;
  chunks_used: number;
  total_chunks: number;
  model: string;
}

export interface QueryResponse {
  answer: string;
  sources: SourceInfo[];
  metadata: QueryMetadata;
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export interface DatasetSummaryResponse {
  id: string;
  name: string;
  description?: string | null;
  document_ids: string[];
  item_count: number;
  created_at: string;
}

export interface TestCaseResponse {
  id: string;
  question: string;
  ground_truth: string;
}

export interface DatasetDetailResponse {
  id: string;
  name: string;
  description?: string | null;
  document_ids: string[];
  items: TestCaseResponse[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface EvalRunRequest {
  dataset_id: string;
  document_ids?: string[] | null;
}

export interface EvalResultResponse {
  id: string;
  question: string;
  ground_truth: string;
  generated_answer: string;
  retrieved_chunks: SourceInfo[];
  metrics: Record<string, number>;
  latency_ms: number;
  tokens_used: number;
  passed: boolean;
  failure_reason?: string | null;
}

export interface EvalRunProgress {
  completed: number;
  total: number;
}

export interface EvalRunResponse {
  id: string;
  status: string;
  dataset_id: string;
  dataset_name?: string | null;
  document_ids: string[];
  config: Record<string, unknown>;
  metrics?: Record<string, number> | null;
  scoring_mode?: string | null;
  progress?: EvalRunProgress | null;
  results?: EvalResultResponse[] | null;
  question_count?: number | null;
  pass_count?: number | null;
  created_at: string;
}

export interface EvalCompareResponse {
  run_a: Record<string, unknown>;
  run_b: Record<string, unknown>;
  deltas: Record<string, number>;
  config_diff: Record<string, unknown>[];
  insights: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ChunkingConfig {
  strategy: string;
  chunk_size: number;
  overlap: number;
}

export interface RetrievalConfig {
  mode: string;
  top_k: number;
  reranker_enabled: boolean;
}

export interface GenerationConfig {
  model: string;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimension: number;
}

export interface ConfigStatus {
  reindexing: boolean;
  active_collection: string;
  collection_ready: boolean;
  scoring_available: boolean;
}

export interface PipelineConfigResponse {
  chunking: ChunkingConfig;
  retrieval: RetrievalConfig;
  generation: GenerationConfig;
  embedding: EmbeddingConfig;
  status: ConfigStatus;
}

export interface PipelineConfigUpdateRequest {
  chunking?: Partial<ChunkingConfig>;
  retrieval?: Partial<RetrievalConfig>;
  generation?: Partial<GenerationConfig>;
  embedding?: Partial<EmbeddingConfig>;
}

// ---------------------------------------------------------------------------
// SSE Stream Events
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "sources"; sources: SourceInfo[] }
  | { type: "metadata"; metadata: QueryMetadata };

// ---------------------------------------------------------------------------
// Chat (client-side)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceInfo[];
  metadata?: QueryMetadata;
}
