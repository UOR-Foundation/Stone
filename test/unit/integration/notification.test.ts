import { NotificationSystem, NotificationChannel, Notification } from '../../../src/integration/notification';

describe('Notification System', () => {
  let notificationSystem: NotificationSystem;

  beforeEach(() => {
    notificationSystem = new NotificationSystem();
  });

  describe('registerChannel', () => {
    it('should register a notification channel', () => {
      const channel: NotificationChannel = {
        id: 'email',
        name: 'Email Notifications',
        description: 'Send notifications via email',
        send: jest.fn()
      };

      notificationSystem.registerChannel(channel);
      
      expect(notificationSystem.getChannel('email')).toBe(channel);
    });

    it('should throw error when registering duplicate channel', () => {
      const channel: NotificationChannel = {
        id: 'email',
        name: 'Email Notifications',
        description: 'Send notifications via email',
        send: jest.fn()
      };

      notificationSystem.registerChannel(channel);
      
      expect(() => notificationSystem.registerChannel(channel)).toThrow();
    });
  });

  describe('sendNotification', () => {
    it('should send notification through specified channel', async () => {
      const mockSend = jest.fn().mockResolvedValue(true);
      
      const channel: NotificationChannel = {
        id: 'slack',
        name: 'Slack Notifications',
        description: 'Send notifications to Slack',
        send: mockSend
      };

      notificationSystem.registerChannel(channel);
      
      const notification: Notification = {
        title: 'Test Notification',
        message: 'This is a test notification',
        level: 'info',
        metadata: { issueId: '123' }
      };
      
      await notificationSystem.sendNotification('slack', notification);
      
      expect(mockSend).toHaveBeenCalledWith(notification);
    });

    it('should throw error when sending to non-existent channel', async () => {
      const notification: Notification = {
        title: 'Test Notification',
        message: 'This is a test notification',
        level: 'info',
        metadata: {}
      };
      
      await expect(notificationSystem.sendNotification('non-existent', notification)).rejects.toThrow();
    });
  });

  describe('broadcastNotification', () => {
    it('should send notification to all registered channels', async () => {
      const mockEmailSend = jest.fn().mockResolvedValue(true);
      const mockSlackSend = jest.fn().mockResolvedValue(true);
      
      const emailChannel: NotificationChannel = {
        id: 'email',
        name: 'Email Notifications',
        description: 'Send notifications via email',
        send: mockEmailSend
      };

      const slackChannel: NotificationChannel = {
        id: 'slack',
        name: 'Slack Notifications',
        description: 'Send notifications to Slack',
        send: mockSlackSend
      };

      notificationSystem.registerChannel(emailChannel);
      notificationSystem.registerChannel(slackChannel);
      
      const notification: Notification = {
        title: 'Broadcast Test',
        message: 'This is a broadcast notification',
        level: 'warn',
        metadata: {}
      };
      
      await notificationSystem.broadcastNotification(notification);
      
      expect(mockEmailSend).toHaveBeenCalledWith(notification);
      expect(mockSlackSend).toHaveBeenCalledWith(notification);
    });
  });

  describe('unregisterChannel', () => {
    it('should unregister a notification channel', () => {
      const channel: NotificationChannel = {
        id: 'email',
        name: 'Email Notifications',
        description: 'Send notifications via email',
        send: jest.fn()
      };

      notificationSystem.registerChannel(channel);
      expect(notificationSystem.getChannel('email')).toBe(channel);
      
      notificationSystem.unregisterChannel('email');
      expect(notificationSystem.getChannel('email')).toBeUndefined();
    });
  });

  describe('configureChannel', () => {
    it('should configure a notification channel with settings', () => {
      const mockSend = jest.fn().mockResolvedValue(true);
      let channelConfig = {};
      
      const channel: NotificationChannel = {
        id: 'email',
        name: 'Email Notifications',
        description: 'Send notifications via email',
        send: mockSend,
        configure: (config) => {
          channelConfig = config;
          return true;
        }
      };

      notificationSystem.registerChannel(channel);
      
      const config = {
        host: 'smtp.example.com',
        port: 587,
        username: 'user',
        password: 'pass'
      };
      
      notificationSystem.configureChannel('email', config);
      
      expect(channelConfig).toEqual(config);
    });

    it('should throw error when configuring non-existent channel', () => {
      expect(() => notificationSystem.configureChannel('non-existent', {})).toThrow();
    });
  });
});