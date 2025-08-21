import { createLogger } from "../logger";
import { getMetrics } from "../metrics";
import type { EmailItem } from "../types";
import type { CommandResult, IEmailCommand } from "./IEmailCommand";

export interface ExecutionResult {
  email: EmailItem;
  results: CommandResult[];
  success: boolean;
  executionTime: number;
  executedCommands: string[];
}

export class EmailCommandExecutor {
  private logger = createLogger("EmailCommandExecutor");
  private commands: IEmailCommand[] = [];
  private executed: IEmailCommand[] = [];

  /**
   * Add a command to the executor
   */
  add(command: IEmailCommand): this {
    this.commands.push(command);
    return this;
  }

  /**
   * Clear all commands
   */
  clear(): this {
    this.commands = [];
    this.executed = [];
    return this;
  }

  /**
   * Execute all commands on the given email
   */
  async executeAll(email: EmailItem): Promise<ExecutionResult> {
    const startTime = Date.now();
    const results: CommandResult[] = [];
    const executedCommands: string[] = [];

    this.logger.info(`Executing ${this.commands.length} commands for email ${email.id}`);

    for (const command of this.commands) {
      if (!command.canExecute(email)) {
        this.logger.debug(`Skipping command ${command.getName()} - cannot execute`);
        continue;
      }

      try {
        const commandTimer = Date.now();
        const result = await command.execute(email);
        const commandTime = Date.now() - commandTimer;

        results.push(result);
        executedCommands.push(command.getName());

        if (result.success) {
          this.executed.push(command);
        }

        // Track metrics (safely, without breaking main flow)
        try {
          getMetrics().increment(`command.${command.getName().toLowerCase()}`, {
            success: result.success ? "true" : "false",
          });
          getMetrics().gauge(`command.${command.getName().toLowerCase()}.duration_ms`, commandTime);
        } catch (metricsError) {
          // Ignore metrics errors - they shouldn't break the main flow
        }

        this.logger.debug(
          `Command ${command.getName()} ${result.success ? "succeeded" : "failed"} in ${commandTime}ms`
        );
      } catch (error) {
        this.logger.error({ error }, `Command ${command.getName()} threw error`);

        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const executionTime = Date.now() - startTime;
    const success = results.every((r) => r.success);

    this.logger.info(
      `Executed ${executedCommands.length} commands in ${executionTime}ms - success: ${success}`
    );

    return {
      email,
      results,
      success,
      executionTime,
      executedCommands,
    };
  }

  /**
   * Execute commands in parallel (when safe to do so)
   */
  async executeParallel(email: EmailItem): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executedCommands: string[] = [];

    this.logger.info(
      `Executing ${this.commands.length} commands in parallel for email ${email.id}`
    );

    // Filter commands that can be executed
    const executableCommands = this.commands.filter((cmd) => cmd.canExecute(email));

    // Execute all commands in parallel
    const promises = executableCommands.map(async (command) => {
      try {
        const commandTimer = Date.now();
        const result = await command.execute(email);
        const commandTime = Date.now() - commandTimer;

        executedCommands.push(command.getName());

        // Track metrics (safely, without breaking main flow)
        try {
          getMetrics().increment(`command.${command.getName().toLowerCase()}`, {
            success: result.success ? "true" : "false",
          });
          getMetrics().gauge(`command.${command.getName().toLowerCase()}.duration_ms`, commandTime);
        } catch (metricsError) {
          // Ignore metrics errors - they shouldn't break the main flow
        }

        if (result.success) {
          this.executed.push(command);
        }

        return result;
      } catch (error) {
        this.logger.error({ error }, `Command ${command.getName()} threw error`);

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const results = await Promise.all(promises);

    const executionTime = Date.now() - startTime;
    const success = results.every((r) => r.success);

    this.logger.info(
      `Executed ${executedCommands.length} commands in parallel in ${executionTime}ms - success: ${success}`
    );

    return {
      email,
      results,
      success,
      executionTime,
      executedCommands,
    };
  }

  /**
   * Undo all executed commands in reverse order
   */
  async undoAll(): Promise<void> {
    this.logger.info(`Undoing ${this.executed.length} commands`);

    for (const command of [...this.executed].reverse()) {
      if (command.undo) {
        try {
          await command.undo();
          this.logger.debug(`Undid command ${command.getName()}`);
        } catch (error) {
          this.logger.error({ error }, `Failed to undo command ${command.getName()}`);
        }
      }
    }

    this.executed = [];
  }

  /**
   * Get command execution pipeline for specific email processing
   */
  static createEmailProcessingPipeline(): EmailCommandExecutor {
    const executor = new EmailCommandExecutor();

    // Add standard email processing commands
    // These would be imported and instantiated
    // executor.add(new ExtractUrlsCommand());
    // executor.add(new ValidateEmailCommand());
    // executor.add(new EnrichEmailCommand());

    return executor;
  }
}
