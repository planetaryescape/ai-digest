import { createLogger } from "../logger";

/**
 * Decorator to log method execution with timing
 */
export function LogExecution(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  const logger = createLogger(`${className}.${propertyKey}`);

  descriptor.value = async function (...args: any[]) {
    const timer = Date.now();
    const argsPreview = args
      .slice(0, 2)
      .map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          return Object.keys(arg).slice(0, 3).join(", ") + "...";
        }
        return String(arg);
      })
      .join(", ");

    logger.info("Starting execution", { args: argsPreview });

    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - timer;

      logger.info(`Completed in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - timer;

      logger.error(`Failed after ${duration}ms`, error);

      throw error;
    }
  };

  return descriptor;
}
