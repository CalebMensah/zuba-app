- [x] Edit `frontend/screens/seller/SellerOrderDetails.tsx`

  - [x] Remove obsolete imports and usage: `useUpdateOrderStatus`, `setDeliveryStatus`, `calculateOrderTotals`

  - [ ] Delete delivery-status modal state + handlers (`showStatusModal`, `handleUpdateDeliveryStatus`, `handleDeliveryStatusChange`) and modal JSX
  - [ ] Update `renderStatusBadge` to use only valid `OrderStatus` values; add `PENDING_PAYMENT`, `PAID`, `DISPUTED`; remove dead statuses
  - [ ] Update `renderActionButtons` switch: remove `CONFIRMED`, `OUT_FOR_DELIVERY`, `DELIVERED`; remove “Update Delivery Status” button for `SHIPPED`; keep only info message
  - [ ] Update `handleMarkAsDelivered` navigation to `AddDeliveryInfo` with `{ orderId, isEdit: false }`
  - [ ] Update `Delivery Information` fields: `recipientName/recipientPhone/recipientAddress` → `recipient/phone/address`; remove `deliveryInstructions` reference if present
  - [ ] Remove `updateOrderStatus.isPending` from `isProcessing`
- [ ] Run frontend TypeScript/typecheck or build to verify compilation
- [ ] Search repo for remaining `setDeliveryStatus` or old field names to confirm cleanup

