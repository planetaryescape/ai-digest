import type { EmailItem } from "../types";

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface IEmailCommand<TResult = any> {
  /**
   * Execute the command on the given email
   */
  execute(email: EmailItem): Promise<CommandResult<TResult>>;

  /**
   * Check if the command can be executed on the given email
   */
  canExecute(email: EmailItem): boolean;

  /**
   * Undo the command (optional)
   */
  undo?(): Promise<void>;

  /**
   * Get command name for logging/metrics
   */
  getName(): string;
}
