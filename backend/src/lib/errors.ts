export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso nao encontrado") {
    super(message, 404);
  }
}

