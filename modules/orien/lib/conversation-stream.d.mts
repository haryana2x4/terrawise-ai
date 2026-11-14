import type { SSEFrame } from "./sse.mjs";
export declare function createConversationStream(
  applyFrame: (frame: SSEFrame) => boolean | void,
): {
  cancel: () => void;
  read: (
    openResponse: (signal: AbortSignal) => Promise<Response>,
  ) => Promise<void>;
};
