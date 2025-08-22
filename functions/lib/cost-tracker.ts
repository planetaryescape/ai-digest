import { COST_LIMITS } from "./constants";
import { createLogger } from "./logger";

const log = createLogger("CostTracker");

export interface ApiCost {
  service: string;
  operation: string;
  cost: number;
  timestamp: Date;
}

export class CostTracker {
  private costs: ApiCost[] = [];
  private totalCost = 0;
  private apiCallCounts: Map<string, number> = new Map();

  recordApiCall(service: string, operation: string, cost?: number): void {
    // Calculate cost if not provided
    const actualCost = cost || this.calculateCost(service, operation);

    const apiCost: ApiCost = {
      service,
      operation,
      cost: actualCost,
      timestamp: new Date(),
    };

    this.costs.push(apiCost);
    this.totalCost += actualCost;

    // Track API call counts
    const key = `${service}:${operation}`;
    this.apiCallCounts.set(key, (this.apiCallCounts.get(key) || 0) + 1);

    log.debug(
      { service, operation, cost: actualCost, totalCost: this.totalCost },
      "API call recorded"
    );

    // Check if we're approaching the cost limit
    if (this.totalCost > COST_LIMITS.MAX_COST_PER_RUN * 0.8) {
      log.warn(
        { totalCost: this.totalCost, limit: COST_LIMITS.MAX_COST_PER_RUN },
        "Approaching cost limit"
      );
    }
  }

  private calculateCost(service: string, operation: string): number {
    // Default costs based on service and operation
    switch (service) {
      case "openai":
        if (operation === "classify" || operation === "analyze" || operation === "critique") {
          return COST_LIMITS.OPENAI_GPT4O_MINI_COST;
        }
        return COST_LIMITS.OPENAI_GPT5_COST;

      case "firecrawl":
        return COST_LIMITS.FIRECRAWL_COST_PER_URL;

      case "brave":
        return COST_LIMITS.BRAVE_SEARCH_COST;

      case "gmail":
        return 0; // Gmail API is free

      default:
        return 0;
    }
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  getCosts(): ApiCost[] {
    return [...this.costs];
  }

  getApiCallCounts(): Map<string, number> {
    return new Map(this.apiCallCounts);
  }

  isWithinBudget(): boolean {
    return this.totalCost <= COST_LIMITS.MAX_COST_PER_RUN;
  }

  getRemainingBudget(): number {
    return Math.max(0, COST_LIMITS.MAX_COST_PER_RUN - this.totalCost);
  }

  canAfford(estimatedCost: number): boolean {
    return this.totalCost + estimatedCost <= COST_LIMITS.MAX_COST_PER_RUN;
  }

  getStats() {
    return {
      totalCost: this.totalCost,
      apiCalls: this.costs.length,
      remainingBudget: this.getRemainingBudget(),
      apiCallBreakdown: Object.fromEntries(this.apiCallCounts),
      costByService: this.getCostByService(),
    };
  }

  private getCostByService(): Record<string, number> {
    const costByService: Record<string, number> = {};

    for (const cost of this.costs) {
      costByService[cost.service] = (costByService[cost.service] || 0) + cost.cost;
    }

    return costByService;
  }

  reset(): void {
    this.costs = [];
    this.totalCost = 0;
    this.apiCallCounts.clear();
  }

  isApproachingLimit(): boolean {
    return this.totalCost > COST_LIMITS.MAX_COST_PER_RUN * 0.8;
  }

  generateReport(): string {
    const stats = this.getStats();
    return `Cost Report:
- Total Cost: $${stats.totalCost.toFixed(4)}
- Remaining Budget: $${stats.remainingBudget.toFixed(4)}
- API Calls: ${stats.apiCalls}
- Cost by Service: ${JSON.stringify(stats.costByService, null, 2)}`;
  }

  shouldStop(): boolean {
    return this.totalCost >= COST_LIMITS.MAX_COST_PER_RUN;
  }

  getCostBreakdown(): Record<string, any> {
    return {
      total: this.totalCost,
      byService: this.getCostByService(),
      apiCalls: Object.fromEntries(this.apiCallCounts),
    };
  }
}
