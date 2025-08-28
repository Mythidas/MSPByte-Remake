export type APIError = {
  module: string;
  context: string;
  message: string;
  time: string;
  code: string | number;
};

export type APIResponse<T> =
  | { data: T; error?: undefined; meta?: Record<string, any> }
  | { data?: undefined; error: APIError; meta?: Record<string, any> };
