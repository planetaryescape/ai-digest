import { createLogger } from "../logger";
import type { Either } from "../utils/fp";
import { left, right } from "../utils/fp";

const log = createLogger("saga");

export interface SagaStep<TInput, TOutput> {
  name: string;
  execute: (input: TInput) => Promise<TOutput>;
  compensate: (input: TInput, error?: Error) => Promise<void>;
}

export interface SagaTransaction<TInput, TOutput> {
  id: string;
  status: "pending" | "running" | "completed" | "compensating" | "failed";
  steps: SagaStep<any, any>[];
  completedSteps: string[];
  currentStep?: string;
  error?: Error;
  startedAt: Date;
  completedAt?: Date;
  input: TInput;
  output?: TOutput;
}

export class Saga<TInput, TOutput> {
  private steps: SagaStep<any, any>[] = [];
  private transactions = new Map<string, SagaTransaction<TInput, TOutput>>();

  constructor(private name: string) {}

  addStep<TStepInput, TStepOutput>(step: SagaStep<TStepInput, TStepOutput>): Saga<TInput, TOutput> {
    this.steps.push(step);
    return this;
  }

  async execute(input: TInput): Promise<Either<Error, TOutput>> {
    const transactionId = this.generateTransactionId();
    const transaction: SagaTransaction<TInput, TOutput> = {
      id: transactionId,
      status: "pending",
      steps: this.steps,
      completedSteps: [],
      startedAt: new Date(),
      input,
    };

    this.transactions.set(transactionId, transaction);

    try {
      transaction.status = "running";
      let currentData: any = input;

      for (const step of this.steps) {
        transaction.currentStep = step.name;
        log.info({ transactionId, step: step.name }, "Executing saga step");

        try {
          currentData = await step.execute(currentData);
          transaction.completedSteps.push(step.name);
          log.info({ transactionId, step: step.name }, "Saga step completed");
        } catch (error) {
          const stepError = error instanceof Error ? error : new Error(String(error));
          log.error({ transactionId, step: step.name, error }, "Saga step failed");

          transaction.status = "compensating";
          transaction.error = stepError;

          await this.compensate(transaction, currentData);

          transaction.status = "failed";
          transaction.completedAt = new Date();

          return left(stepError);
        }
      }

      transaction.status = "completed";
      transaction.output = currentData as TOutput;
      transaction.completedAt = new Date();

      log.info({ transactionId }, "Saga completed successfully");
      return right(currentData as TOutput);
    } catch (error) {
      const sagaError = error instanceof Error ? error : new Error(String(error));
      transaction.status = "failed";
      transaction.error = sagaError;
      transaction.completedAt = new Date();

      log.error({ transactionId, error }, "Saga failed");
      return left(sagaError);
    }
  }

  private async compensate(
    transaction: SagaTransaction<TInput, TOutput>,
    lastData: any
  ): Promise<void> {
    log.info({ transactionId: transaction.id }, "Starting compensation");

    // Compensate in reverse order
    const stepsToCompensate = [...transaction.completedSteps].reverse();
    const compensationData = lastData;

    for (const stepName of stepsToCompensate) {
      const step = this.steps.find((s) => s.name === stepName);
      if (!step) continue;

      try {
        log.info({ transactionId: transaction.id, step: stepName }, "Compensating step");
        await step.compensate(compensationData, transaction.error);
        log.info({ transactionId: transaction.id, step: stepName }, "Step compensated");
      } catch (compensationError) {
        log.error(
          { transactionId: transaction.id, step: stepName, error: compensationError },
          "Compensation failed for step"
        );
        // Continue compensating other steps even if one fails
      }
    }

    log.info({ transactionId: transaction.id }, "Compensation completed");
  }

  getTransaction(transactionId: string): SagaTransaction<TInput, TOutput> | undefined {
    return this.transactions.get(transactionId);
  }

  getAllTransactions(): SagaTransaction<TInput, TOutput>[] {
    return Array.from(this.transactions.values());
  }

  private generateTransactionId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class SagaBuilder<TInput> {
  private saga: Saga<TInput, any>;

  constructor(name: string) {
    this.saga = new Saga(name);
  }

  step<TStepInput, TStepOutput>(
    name: string,
    execute: (input: TStepInput) => Promise<TStepOutput>,
    compensate: (input: TStepInput, error?: Error) => Promise<void>
  ): SagaBuilder<TInput> {
    this.saga.addStep({ name, execute, compensate });
    return this;
  }

  build<TOutput>(): Saga<TInput, TOutput> {
    return this.saga as Saga<TInput, TOutput>;
  }
}

export interface ParallelSagaStep<TInput, TOutput> {
  name: string;
  steps: SagaStep<TInput, any>[];
  combiner: (results: any[]) => TOutput;
}

export class ParallelSaga<TInput, TOutput> extends Saga<TInput, TOutput> {
  private parallelSteps: ParallelSagaStep<any, any>[] = [];

  addParallelSteps<TStepInput, TStepOutput>(
    name: string,
    steps: SagaStep<TStepInput, any>[],
    combiner: (results: any[]) => TStepOutput
  ): ParallelSaga<TInput, TOutput> {
    this.parallelSteps.push({ name, steps, combiner });
    return this;
  }

  async execute(input: TInput): Promise<Either<Error, TOutput>> {
    const transactionId = this.generateTransactionId();
    let currentData: any = input;
    const completedParallelSteps: Array<{ name: string; steps: string[] }> = [];

    try {
      for (const parallelStep of this.parallelSteps) {
        log.info({ transactionId, step: parallelStep.name }, "Executing parallel saga steps");

        const promises = parallelStep.steps.map((step) => step.execute(currentData));

        try {
          const results = await Promise.all(promises);
          currentData = parallelStep.combiner(results);

          completedParallelSteps.push({
            name: parallelStep.name,
            steps: parallelStep.steps.map((s) => s.name),
          });

          log.info({ transactionId, step: parallelStep.name }, "Parallel steps completed");
        } catch (error) {
          const stepError = error instanceof Error ? error : new Error(String(error));
          log.error({ transactionId, step: parallelStep.name, error }, "Parallel steps failed");

          // Compensate completed parallel steps
          await this.compensateParallel(completedParallelSteps, currentData, stepError);

          return left(stepError);
        }
      }

      log.info({ transactionId }, "Parallel saga completed successfully");
      return right(currentData as TOutput);
    } catch (error) {
      const sagaError = error instanceof Error ? error : new Error(String(error));
      log.error({ transactionId, error }, "Parallel saga failed");
      return left(sagaError);
    }
  }

  private async compensateParallel(
    completedSteps: Array<{ name: string; steps: string[] }>,
    lastData: any,
    error: Error
  ): Promise<void> {
    // Compensate in reverse order
    for (const parallelStep of [...completedSteps].reverse()) {
      const parallel = this.parallelSteps.find((ps) => ps.name === parallelStep.name);
      if (!parallel) continue;

      // Compensate all steps in parallel
      const compensationPromises = parallel.steps.map((step) =>
        step.compensate(lastData, error).catch((err) => {
          log.error({ step: step.name, error: err }, "Parallel compensation failed");
        })
      );

      await Promise.all(compensationPromises);
    }
  }

  private generateTransactionId(): string {
    return `parallel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class ChainedSaga<TInput, TOutput> {
  private sagas: Array<Saga<any, any>> = [];

  constructor(private name: string) {}

  chain<TSagaInput, TSagaOutput>(
    saga: Saga<TSagaInput, TSagaOutput>
  ): ChainedSaga<TInput, TOutput> {
    this.sagas.push(saga);
    return this;
  }

  async execute(input: TInput): Promise<Either<Error, TOutput>> {
    let currentData: any = input;
    const completedSagas: Array<{ saga: Saga<any, any>; output: any }> = [];

    for (const saga of this.sagas) {
      const result = await saga.execute(currentData);

      if (result.isLeft()) {
        // Rollback completed sagas
        await this.rollback(completedSagas);
        return left(
          result.fold(
            (e) => e,
            () => new Error("Unknown error")
          )
        );
      }

      currentData = result.getOrElse(currentData);
      completedSagas.push({ saga, output: currentData });
    }

    return right(currentData as TOutput);
  }

  private async rollback(
    completedSagas: Array<{ saga: Saga<any, any>; output: any }>
  ): Promise<void> {
    log.info({ name: this.name }, "Rolling back chained sagas");

    // In a real implementation, we would need a way to rollback entire sagas
    // For now, we just log the rollback
    for (const { saga } of [...completedSagas].reverse()) {
      log.info({ saga: saga["name"] }, "Would rollback saga");
    }
  }
}

export function createSaga<TInput>(name: string): SagaBuilder<TInput> {
  return new SagaBuilder<TInput>(name);
}

export function createParallelSaga<TInput, TOutput>(name: string): ParallelSaga<TInput, TOutput> {
  return new ParallelSaga<TInput, TOutput>(name);
}

export function createChainedSaga<TInput, TOutput>(name: string): ChainedSaga<TInput, TOutput> {
  return new ChainedSaga<TInput, TOutput>(name);
}
