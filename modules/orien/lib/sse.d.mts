export type SSEFrame = { event?: string; data: string; id?: string };

export declare function consumeSSE(
  response: Response,
  onFrame: (frame: SSEFrame) => boolean | void,
  options?: { signal?: AbortSignal },
): Promise<void>;

export declare function encodeSSE(event: string, data: unknown): string;
