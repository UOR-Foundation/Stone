/**
 * Interface defining a notification
 */
export interface Notification {
  title: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
  metadata: Record<string, any>;
}

/**
 * Interface defining a notification channel
 */
export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  send: (notification: Notification) => Promise<boolean>;
  configure?: (config: any) => boolean;
}

/**
 * Class for managing the notification system
 */
export class NotificationSystem {
  private channels: Map<string, NotificationChannel> = new Map();

  /**
   * Registers a notification channel
   */
  registerChannel(channel: NotificationChannel): void {
    if (this.channels.has(channel.id)) {
      throw new Error(`Channel with ID "${channel.id}" is already registered`);
    }

    this.channels.set(channel.id, channel);
  }

  /**
   * Gets a channel by ID
   */
  getChannel(id: string): NotificationChannel | undefined {
    return this.channels.get(id);
  }

  /**
   * Unregisters a channel by ID
   */
  unregisterChannel(id: string): boolean {
    return this.channels.delete(id);
  }

  /**
   * Sends a notification through a specific channel
   */
  async sendNotification(channelId: string, notification: Notification): Promise<boolean> {
    const channel = this.getChannel(channelId);
    if (!channel) {
      throw new Error(`Notification channel "${channelId}" not found`);
    }

    return await channel.send(notification);
  }

  /**
   * Broadcasts a notification to all registered channels
   */
  async broadcastNotification(notification: Notification): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [id, channel] of this.channels.entries()) {
      try {
        results[id] = await channel.send(notification);
      } catch (error) {
        console.error(`Error sending notification to channel "${id}": ${error.message}`);
        results[id] = false;
      }
    }

    return results;
  }

  /**
   * Configures a notification channel with settings
   */
  configureChannel(channelId: string, config: any): boolean {
    const channel = this.getChannel(channelId);
    if (!channel) {
      throw new Error(`Notification channel "${channelId}" not found`);
    }

    if (!channel.configure) {
      throw new Error(`Channel "${channelId}" does not support configuration`);
    }

    return channel.configure(config);
  }

  /**
   * Gets all registered channels
   */
  getAllChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }
}

/**
 * Export necessary components
 */
export default {
  NotificationSystem
};