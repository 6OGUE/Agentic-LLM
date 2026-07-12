export interface ChatResponse {
  status: "success" | "requires_confirmation" | "error";
  response?: string;       // Final answer
  message?: string;        // Confirmation message
  tool_name?: string;      // Tool requesting permission
  tool_args?: any;
  data?: string;           // Optional extra data
}