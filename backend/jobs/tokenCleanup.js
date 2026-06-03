// Use node-cron or similar
   cron.schedule('0 2 * * *', async () => {
     await TokenManager.cleanup();
   });