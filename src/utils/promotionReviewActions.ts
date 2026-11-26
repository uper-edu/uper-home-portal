export const promotionReviewActions = [
  { value: 'link', label: 'Link existing promotion entry' },
  { value: 'campaign', label: 'Confirm campaign only' },
  { value: 'defer', label: 'Leave unconfirmed' },
  { value: 'invalid', label: 'Mark invalid' },
] as const;
export function isPromotionReviewPending(status: unknown) {
  return status === 'pending' || status === 'deferred';
}
