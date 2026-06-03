# Guest User Feature Implementation Plan

## Phase 1: Core Infrastructure Updates

### 1. Update AuthContext.tsx
- [ ] Add `isGuest` state
- [ ] Add `loginAsGuest()` function
- [ ] Add `guestCart` persistence using AsyncStorage
- [ ] Add helper functions for guest mode management

### 2. Update CartContext.tsx
- [ ] Implement local cart storage for guests using AsyncStorage
- [ ] Create `guestCart` state
- [ ] Add `fetchGuestCart()` function
- [ ] Add `addToGuestCart()`, `removeFromGuestCart()`, `updateGuestCartItem()` functions
- [ ] Modify `addItem`, `updateItemQuantity`, `removeItem`, `clearCart` to check auth state
- [ ] Add `syncGuestCartToServer()` for when guest logs in

## Phase 2: Navigation Architecture

### 3. Update RootNavigator.tsx
- [ ] Modify logic to show BuyerNavigator when guest or not authenticated
- [ ] Update conditional rendering for Main navigator

### 4. Update AuthNavigator.tsx
- [ ] Add Marketplace to routes accessible by guests
- [ ] Fix "Continue as Guest" navigation

## Phase 3: User Experience Refinements

### 5. Update BuyerProfileScreen.tsx
- [ ] Check if user is guest using `useAuth`
- [ ] Show "Sign in to access" message for guest-specific features
- [ ] Show simplified profile with login prompt
- [ ] Disable/redirect actions that require authentication

### 6. Update CartScreen.tsx
- [ ] Handle guest cart mode
- [ ] Show "Sign in to save cart" message
- [ ] Enable checkout flow for guests (with signup prompt)

### 7. Update LoginScreen.tsx
- [ ] Fix "Continue as Guest" button navigation

### 8. Update MarketplaceScreen.tsx
- [ ] Update cart button to handle guest mode
- [ ] Add login/signup prompts where needed

## Implementation Order:
1. AuthContext.tsx (core infrastructure) ✅
2. CartContext.tsx (guest cart support) ✅
3. RootNavigator.tsx (navigation logic) ✅
4. BuyerProfileScreen.tsx (guest profile) ✅
5. CartScreen.tsx (guest cart) ✅
6. LoginScreen.tsx (fix navigation) ✅
7. MarketplaceScreen.tsx (cart integration) ✅

