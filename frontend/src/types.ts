export interface ChatResponse {
  status: "success" | "requires_confirmation" | "error";
  response?: string;       // Final answer
  message?: string;        // Confirmation message
  confirmed_message?: string; // Past-tense message after approval
  tool_name?: string;      // Tool requesting permission
  tool_args?: any;
  continuation?: string;   // Follow-up context for the next confirmed tool
  task_id?: string;        // Server-side task state for resuming after confirmation
  data?: string;           // Optional extra data
}

export interface ToolCallEvent {
  event: "tool_call";
  tool_name: string;
}

export interface IterationEvent {
  event: "iteration";
  iteration: number;
}

export interface InternalEvent {
  event: "llm_call" | "tool_execution" | "agent_response";
  iteration?: number;
  model?: string;
  tool_name?: string;
  tool_args?: unknown;
  response?: unknown;
  result?: unknown;
  duration_seconds?: number;
  status?: "started" | "completed";
}