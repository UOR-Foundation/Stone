import os from 'os';
import { LoggerService } from '../services/logger-service';

/**
 * Resource usage limits
 */
export interface ResourceLimits {
  memoryMB?: number;
  cpuPercent?: number;
  maxParallelism?: number;
  fileSizeMB?: number;
  networkMBps?: number;
}

/**
 * Current resource usage
 */
export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  parallelOperations: number;
  diskUsageMB: number;
  networkUsageMBps: number;
}

/**
 * Configuration for the resource controller
 */
export interface ResourceControllerConfig {
  checkIntervalMs: number;
  autoThrottle: boolean;
  limits: ResourceLimits;
}

/**
 * Controls resource allocation and enforces usage limits
 */
export class ResourceController {
  private config: Required<ResourceControllerConfig>;
  private usage: ResourceUsage;
  private checkInterval: NodeJS.Timeout | null = null;
  private isThrottled = false;
  private throttleCallbacks: Array<() => void> = [];
  private resumeCallbacks: Array<() => void> = [];

  constructor(
    private logger: LoggerService,
    config?: Partial<ResourceControllerConfig>
  ) {
    // Default configuration
    this.config = {
      checkIntervalMs: 5000, // 5 seconds
      autoThrottle: true,
      limits: {
        memoryMB: Math.round(os.totalmem() / 1024 / 1024 * 0.8), // 80% of total memory
        cpuPercent: 80, // 80% of CPU
        maxParallelism: os.cpus().length, // Number of CPU cores
        fileSizeMB: 1000, // 1GB
        networkMBps: 50 // 50 MB/s
      },
      ...config
    };

    // Initialize usage metrics
    this.usage = {
      memoryMB: 0,
      cpuPercent: 0,
      parallelOperations: 0,
      diskUsageMB: 0,
      networkUsageMBps: 0
    };

    // Start monitoring if auto-throttle is enabled
    if (this.config.autoThrottle) {
      this.startMonitoring();
    }
  }

  /**
   * Start resource monitoring
   */
  public startMonitoring(): void {
    if (this.checkInterval) {
      return; // Already monitoring
    }

    this.logger.info('Starting resource monitoring');
    
    this.checkInterval = setInterval(() => {
      this.checkResources();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop resource monitoring
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Stopped resource monitoring');
    }
  }

  /**
   * Get current resource usage
   * @returns Current resource usage metrics
   */
  public getResourceUsage(): ResourceUsage {
    // Update usage before returning
    this.updateResourceUsage();
    return { ...this.usage };
  }

  /**
   * Get configured resource limits
   * @returns Current resource limits
   */
  public getResourceLimits(): ResourceLimits {
    return { ...this.config.limits };
  }

  /**
   * Update resource limits
   * @param limits New resource limits
   */
  public updateLimits(limits: Partial<ResourceLimits>): void {
    this.config.limits = {
      ...this.config.limits,
      ...limits
    };
    
    this.logger.info('Updated resource limits', { limits: this.config.limits });
  }

  /**
   * Check if an operation would exceed resource limits
   * @param requiredResources Resources required by the operation
   * @returns Whether the operation would exceed limits
   */
  public wouldExceedLimits(requiredResources: Partial<ResourceUsage>): boolean {
    const usage = this.getResourceUsage();
    
    // Check each resource type
    if (requiredResources.memoryMB && 
        this.config.limits.memoryMB && 
        usage.memoryMB + requiredResources.memoryMB > this.config.limits.memoryMB) {
      return true;
    }
    
    if (requiredResources.parallelOperations && 
        this.config.limits.maxParallelism && 
        usage.parallelOperations + requiredResources.parallelOperations > this.config.limits.maxParallelism) {
      return true;
    }
    
    if (requiredResources.diskUsageMB && 
        this.config.limits.fileSizeMB && 
        usage.diskUsageMB + requiredResources.diskUsageMB > this.config.limits.fileSizeMB) {
      return true;
    }
    
    if (requiredResources.networkUsageMBps && 
        this.config.limits.networkMBps && 
        usage.networkUsageMBps + requiredResources.networkUsageMBps > this.config.limits.networkMBps) {
      return true;
    }
    
    return false;
  }

  /**
   * Register for throttle events
   * @param callback Function to call when system is throttled
   */
  public onThrottle(callback: () => void): void {
    this.throttleCallbacks.push(callback);
  }

  /**
   * Register for resume events
   * @param callback Function to call when system resumes from throttle
   */
  public onResume(callback: () => void): void {
    this.resumeCallbacks.push(callback);
  }

  /**
   * Increment counter for parallel operations
   * @param count Number of operations to add (default: 1)
   */
  public incrementParallelOperations(count: number = 1): void {
    this.usage.parallelOperations += count;
  }

  /**
   * Decrement counter for parallel operations
   * @param count Number of operations to remove (default: 1)
   */
  public decrementParallelOperations(count: number = 1): void {
    this.usage.parallelOperations = Math.max(0, this.usage.parallelOperations - count);
  }

  /**
   * Update current resource usage metrics
   */
  private updateResourceUsage(): void {
    try {
      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      this.usage.memoryMB = Math.round(usedMem / 1024 / 1024);
      
      // CPU usage (average across all cores)
      const cpus = os.cpus();
      let totalCpuUsage = 0;
      
      for (const cpu of cpus) {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
        const idle = cpu.times.idle;
        const used = total - idle;
        totalCpuUsage += (used / total) * 100;
      }
      
      this.usage.cpuPercent = Math.round(totalCpuUsage / cpus.length);
      
      // Disk and network usage are harder to measure accurately in Node.js
      // In a real implementation, you might use system-specific tools or libraries
      // Here we're just using placeholder values
      this.usage.diskUsageMB = 0; // Placeholder
      this.usage.networkUsageMBps = 0; // Placeholder
      
      this.logger.debug('Updated resource usage', { usage: this.usage });
    } catch (error) {
      this.logger.error('Failed to update resource usage', { error: error.message });
    }
  }

  /**
   * Check if resource usage exceeds limits and throttle if needed
   */
  private checkResources(): void {
    this.updateResourceUsage();
    
    let shouldThrottle = false;
    
    // Check each resource type
    if (this.config.limits.memoryMB && this.usage.memoryMB > this.config.limits.memoryMB) {
      this.logger.warn(`Memory usage exceeds limit: ${this.usage.memoryMB}MB > ${this.config.limits.memoryMB}MB`);
      shouldThrottle = true;
    }
    
    if (this.config.limits.cpuPercent && this.usage.cpuPercent > this.config.limits.cpuPercent) {
      this.logger.warn(`CPU usage exceeds limit: ${this.usage.cpuPercent}% > ${this.config.limits.cpuPercent}%`);
      shouldThrottle = true;
    }
    
    if (this.config.limits.maxParallelism && this.usage.parallelOperations > this.config.limits.maxParallelism) {
      this.logger.warn(`Parallel operations exceed limit: ${this.usage.parallelOperations} > ${this.config.limits.maxParallelism}`);
      shouldThrottle = true;
    }
    
    // Apply throttling if needed
    if (shouldThrottle && !this.isThrottled) {
      this.applyThrottle();
    } else if (!shouldThrottle && this.isThrottled) {
      this.removeThrottle();
    }
  }

  /**
   * Apply resource throttling
   */
  private applyThrottle(): void {
    this.isThrottled = true;
    this.logger.warn('Applying resource throttling');
    
    // Notify all registered callbacks
    for (const callback of this.throttleCallbacks) {
      try {
        callback();
      } catch (error) {
        this.logger.error('Error in throttle callback', { error: error.message });
      }
    }
  }

  /**
   * Remove resource throttling
   */
  private removeThrottle(): void {
    this.isThrottled = false;
    this.logger.info('Removing resource throttling');
    
    // Notify all registered callbacks
    for (const callback of this.resumeCallbacks) {
      try {
        callback();
      } catch (error) {
        this.logger.error('Error in resume callback', { error: error.message });
      }
    }
  }
}
