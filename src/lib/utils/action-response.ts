export type ActionSuccess<T> = {
  success: true;
  data: T;
};

export type ActionFailure = {
  success: false;
  error: string;
};

export type ActionResponse<T> = ActionSuccess<T> | ActionFailure;

/** Extract the `data` field type from an ActionResponse return type. */
export type ActionData<T> = T extends { success: true; data: infer D } ? D : never;

export function successResponse<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function errorResponse(error: string): ActionFailure {
  return { success: false, error };
}
