import admin from 'firebase-admin';

interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  databaseURL?: string;
}

class FirebaseService {
  private static instance: FirebaseService;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  public initialize(): void {
    if (this.initialized) {
      console.log('Firebase Admin SDK already initialized');
      return;
    }

    const isEnabled = process.env.FIREBASE_ENABLED === 'true';

    console.log('\n🔥 Firebase Cloud Messaging Initialization...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!isEnabled) {
      console.log('⚠️  Firebase is DISABLED via FIREBASE_ENABLED env variable');
      console.log('   Set FIREBASE_ENABLED=true in .env to enable push notifications');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    try {
      const config: FirebaseConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID || 'placeholder-project-id',
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'placeholder@placeholder.iam.gserviceaccount.com',
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      };

      // Validation checks
      const hasProjectId = config.projectId && config.projectId !== 'placeholder-project-id';
      const hasPrivateKey = config.privateKey && config.privateKey.includes('BEGIN PRIVATE KEY');
      const hasClientEmail = config.clientEmail && config.clientEmail !== 'placeholder@placeholder.iam.gserviceaccount.com';

      console.log('📋 Configuration Check:');
      console.log(`   Project ID: ${hasProjectId ? '✓' : '✗'} ${config.projectId}`);
      console.log(`   Client Email: ${hasClientEmail ? '✓' : '✗'} ${config.clientEmail}`);
      console.log(`   Private Key: ${hasPrivateKey ? '✓ Present' : '✗ Missing'} (${config.privateKey.length} chars)`);

      if (config.databaseURL) {
        console.log(`   Database URL: ✓ ${config.databaseURL}`);
      }

      if (!hasProjectId || !hasPrivateKey || !hasClientEmail) {
        console.log('\n❌ Firebase configuration incomplete!');
        console.log('   Missing required fields. Please update .env with valid Firebase credentials.');
        console.log('   See FIREBASE_SETUP.md for detailed setup instructions.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return;
      }

      // Initialize Firebase Admin with service account credentials
      console.log('\n🔄 Initializing Firebase Admin SDK...');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.projectId,
          privateKey: config.privateKey,
          clientEmail: config.clientEmail,
        }),
        databaseURL: config.databaseURL,
      });

      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully!');
      console.log('📱 Push notifications are ENABLED');
      console.log('   - Silent notifications: Data-only updates');
      console.log('   - Active notifications: Visible alerts');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error: any) {
      console.log('\n❌ Failed to initialize Firebase Admin SDK');
      console.log(`   Error: ${error.message}`);

      if (error.message.includes('private_key')) {
        console.log('\n💡 Private Key Issue Detected:');
        console.log('   - Make sure FIREBASE_PRIVATE_KEY is wrapped in double quotes');
        console.log('   - Keep all \\n characters in the key');
        console.log('   - Format: FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
      }

      if (error.message.includes('project_id')) {
        console.log('\n💡 Project ID Issue:');
        console.log('   - Verify FIREBASE_PROJECT_ID matches your Firebase project');
      }

      console.log('\n⚠️  Push notifications will NOT work until this is resolved.');
      console.log('   See FIREBASE_SETUP.md for detailed setup instructions.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }

  /**
   * Check if Firebase is initialized and ready
   */
  public isReady(): boolean {
    return this.initialized;
  }

  /**
   * Send a SILENT notification (data-only, no visible notification)
   * Used for triggering API calls and data updates in the background
   *
   * @param tokens - FCM device tokens to send to
   * @param data - Data payload to send (will trigger onBackgroundMessage)
   */
  public async sendSilentNotification(
    tokens: string | string[],
    data: Record<string, string>
  ): Promise<{ success: boolean; failedTokens?: string[] }> {
    if (!this.initialized) {
      console.warn('Firebase not initialized. Silent notification not sent.');
      return { success: false };
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      if (tokenArray.length === 0) {
        return { success: false };
      }

      // Send data-only message (silent notification)
      const message: admin.messaging.MulticastMessage = {
        tokens: tokenArray,
        data: {
          type: 'silent', // Default to silent if not specified
          ...data, // Data overrides the default type
          timestamp: Date.now().toString(),
        },
        // Android-specific configuration for background delivery
        android: {
          priority: 'high',
          // No notification object = silent notification
        },
        // iOS-specific configuration
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              contentAvailable: true, // Enable background processing
            },
          },
        },
        // Web push configuration
        webpush: {
          headers: {
            Urgency: 'high',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokenArray[idx]);
          console.error(`❌ Failed to send to token ${idx}:`, resp.error?.message || resp.error);
        } else {
          console.log(`✅ Successfully sent to token ${idx}:`, tokenArray[idx].substring(0, 30) + '...');
        }
      });

      console.log(`📊 Silent notification result: ${response.successCount} succeeded, ${response.failureCount} failed`);

      return {
        success: response.successCount > 0,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      };
    } catch (error: any) {
      console.error('Error sending silent notification:', error);
      return { success: false };
    }
  }

  /**
   * Send an ACTIVE notification (visible notification with alert)
   * Used for important updates like order status changes
   *
   * @param tokens - FCM device tokens to send to
   * @param notification - Notification title, body, and other display options
   * @param data - Optional data payload
   */
  public async sendActiveNotification(
    tokens: string | string[],
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
      clickAction?: string;
    },
    data?: Record<string, string>
  ): Promise<{ success: boolean; failedTokens?: string[] }> {
    if (!this.initialized) {
      console.warn('Firebase not initialized. Active notification not sent.');
      return { success: false };
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      if (tokenArray.length === 0) {
        return { success: false };
      }

      // Send notification with visible alert
      const message: admin.messaging.MulticastMessage = {
        tokens: tokenArray,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...(data || {}),
          type: 'active', // Mark as active for client-side handling
          title: notification.title, // Include title in data for easy access
          body: notification.body, // Include body in data for easy access
          clickAction: notification.clickAction || '/',
          timestamp: Date.now().toString(),
        },
        // Android-specific configuration
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'order_updates',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        // iOS-specific configuration
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
        // Web push configuration
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/logo.png',
            badge: '/badge.png',
            requireInteraction: true,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokenArray[idx]);
          console.error(`❌ Failed to send to token ${idx}:`, resp.error?.message || resp.error);
          console.error(`   Error code:`, resp.error?.code);
        } else {
          console.log(`✅ Successfully sent to token ${idx}:`, tokenArray[idx].substring(0, 30) + '...');
        }
      });

      console.log(`📊 Active notification result: ${response.successCount} succeeded, ${response.failureCount} failed`);

      return {
        success: response.successCount > 0,
        failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
      };
    } catch (error: any) {
      console.error('Error sending active notification:', error);
      return { success: false };
    }
  }

  /**
   * Send notification to a topic (for broadcast messages)
   *
   * @param topic - Topic name (e.g., 'restaurant_123', 'all_users')
   * @param notification - Notification content
   * @param data - Optional data payload
   * @param silent - Whether to send as silent notification
   */
  public async sendToTopic(
    topic: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
    silent: boolean = false
  ): Promise<{ success: boolean }> {
    if (!this.initialized) {
      console.warn('Firebase not initialized. Topic notification not sent.');
      return { success: false };
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        ...(silent
          ? {
              // Silent notification
              data: {
                ...(data || {}),
                type: 'silent',
                timestamp: Date.now().toString(),
              },
            }
          : {
              // Active notification
              notification: {
                title: notification.title,
                body: notification.body,
              },
              data: {
                ...(data || {}),
                type: 'active',
                timestamp: Date.now().toString(),
              },
            }),
      };

      await admin.messaging().send(message);
      console.log(`✅ Notification sent to topic: ${topic}`);
      return { success: true };
    } catch (error: any) {
      console.error(`Error sending to topic ${topic}:`, error);
      return { success: false };
    }
  }

  /**
   * Subscribe tokens to a topic
   *
   * @param tokens - FCM tokens to subscribe
   * @param topic - Topic name
   */
  public async subscribeToTopic(tokens: string | string[], topic: string): Promise<void> {
    if (!this.initialized) {
      console.warn('Firebase not initialized. Cannot subscribe to topic.');
      return;
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      await admin.messaging().subscribeToTopic(tokenArray, topic);
      console.log(`✅ ${tokenArray.length} token(s) subscribed to topic: ${topic}`);
    } catch (error: any) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }

  /**
   * Unsubscribe tokens from a topic
   *
   * @param tokens - FCM tokens to unsubscribe
   * @param topic - Topic name
   */
  public async unsubscribeFromTopic(tokens: string | string[], topic: string): Promise<void> {
    if (!this.initialized) {
      console.warn('Firebase not initialized. Cannot unsubscribe from topic.');
      return;
    }

    try {
      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
      await admin.messaging().unsubscribeFromTopic(tokenArray, topic);
      console.log(`✅ ${tokenArray.length} token(s) unsubscribed from topic: ${topic}`);
    } catch (error: any) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  }
}

// Export singleton instance
export default FirebaseService.getInstance();
