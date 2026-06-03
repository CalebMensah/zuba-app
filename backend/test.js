import admin from './config/firebase.js';

async function testFCM() {
  try {
    console.log('📨 Sending test FCM notification...');

    const response = await admin.messaging().send({
      token: 'fTulvdl9SpiYn_Sea9Ftpf:APA91bFoaDQE_A_iOHFHz2gee9-ia8gTBBl0aNuMmTHUJYgbCChcLmsyO0cb0cFR5HSXb5gnQ6JXuYsfyZJf83YBv9E8-cWdr42pv-ACl2AfXCQYSCjoCHw',
      notification: {
        title: 'FCM Test ✅',
        body: 'FCM notifications are working!',
      },
      android: {
        priority: 'high',
      },
    });

    console.log('✅ Notification sent successfully');
    console.log('📩 Firebase response:', response);
  } catch (error) {
    console.error('❌ Failed to send notification');
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testFCM();
