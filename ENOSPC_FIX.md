# ENOSPC Error Fix Solutions

## Current Issue
Your system has reached the limit for file watchers (inotify instances). This is common with Expo projects due to the large number of dependencies.

## Quick Fixes (Try in this order)

### 1. Clean and Restart
```bash
# In your frontend directory
cd frontend
rm -rf node_modules
npm install
# Kill any existing metro processes
pkill -f metro
# Restart with clearing cache
npx expo start --clear
```

### 2. Use --non-interactive flag
```bash
cd frontend
npx expo start --non-interactive --no-dev-client
```

### 3. Disable file watching for node_modules
```bash
cd frontend
npx expo start --max-workers 1
```

### 4. Increase system limit (requires sudo)
```bash
# Temporary (for current session only)
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches

# Permanent
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 5. Alternative: Use Webpack bundler instead of Metro
```bash
cd frontend
npx expo start --platform web
```

## Recommended Approach
1. Try solution #1 first (clean restart)
2. If that doesn't work, try #2 or #3
3. For permanent fix, use #4 when you have sudo access

## Check current limit
```bash
cat /proc/sys/fs/inotify/max_user_watches
