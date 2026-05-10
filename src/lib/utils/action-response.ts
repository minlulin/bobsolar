export type ActionSuccess<T> = {
  success: true;
  data: T;
};

export type ActionFailure = {
  success: false;
  error: string;
};

export type ActionResponse<T> = ActionSuccess<T> | ActionFailure;

export function successResponse<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function errorResponse(error: string): ActionFailure {
  return { success: false, error };
}
