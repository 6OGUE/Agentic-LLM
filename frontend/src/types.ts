export interface ChatResponse {
  status: "success" | "requires_confirmation" | "error";
  response?: string;       // Final answer
  message?: string;        // Confirmation message
  tool_name?: string;      // Tool requesting permission
  tool_args?: any;
  continuation?: string;   // Follow-up context for the next confirmed tool
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
  status?: "started" | "completed";
}